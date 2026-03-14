import { describe, it, expect } from "vitest";
import { parseBoolean } from "./parse-boolean";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Collapse all whitespace runs to a single space for readable SQL comparisons */
function norm(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

// ── Single tag ────────────────────────────────────────────────────────────────

describe("single tag", () => {
  it("produces a GIN containment check", () => {
    const { sql, params } = parseBoolean("DSNS");
    expect(norm(sql)).toBe("gen_ed_tags @> ARRAY[$1]::text[]");
    expect(params).toEqual(["DSNS"]);
  });

  it("uppercases a lowercase tag", () => {
    const { sql, params } = parseBoolean("dsns");
    expect(norm(sql)).toBe("gen_ed_tags @> ARRAY[$1]::text[]");
    expect(params).toEqual(["DSNS"]);
  });

  it("reports the tag in allTags", () => {
    const { allTags } = parseBoolean("SCIS");
    expect(allTags).toEqual(["SCIS"]);
  });
});

// ── OR ────────────────────────────────────────────────────────────────────────

describe("OR expression", () => {
  it("wraps both sides with OR", () => {
    const { sql, params } = parseBoolean("DVUP OR DSHS");
    expect(norm(sql)).toBe(
      "(gen_ed_tags @> ARRAY[$1]::text[] OR gen_ed_tags @> ARRAY[$2]::text[])"
    );
    expect(params).toEqual(["DVUP", "DSHS"]);
  });

  it("is case-insensitive for the OR keyword", () => {
    const { params } = parseBoolean("DVUP or DSHS");
    expect(params).toEqual(["DVUP", "DSHS"]);
  });

  it("collects both tags in allTags", () => {
    const { allTags } = parseBoolean("DVUP OR DSHS");
    expect(allTags.sort()).toEqual(["DSHS", "DVUP"]);
  });

  it("chains three ORs left-associatively", () => {
    const { sql, params } = parseBoolean("DSNS OR DVUP OR SCIS");
    // Left-associative: ((DSNS OR DVUP) OR SCIS)
    expect(norm(sql)).toContain("OR");
    expect(params).toEqual(["DSNS", "DVUP", "SCIS"]);
  });
});

// ── AND ───────────────────────────────────────────────────────────────────────

describe("AND expression — co-occurrence semantics", () => {
  it("uses a JSONB EXISTS co-occurrence check", () => {
    const { sql, params } = parseBoolean("DVUP AND DSHS");
    expect(norm(sql)).toContain("EXISTS");
    expect(norm(sql)).toContain("jsonb_array_elements(gen_ed_raw)");
    expect(norm(sql)).toContain("grp @> to_jsonb($1::text)");
    expect(norm(sql)).toContain("grp @> to_jsonb($2::text)");
    expect(params).toEqual(["DVUP", "DSHS"]);
  });

  it("is case-insensitive for the AND keyword", () => {
    const { params } = parseBoolean("DVUP and DSHS");
    expect(params).toEqual(["DVUP", "DSHS"]);
  });

  it("collects three tags into one EXISTS when chained", () => {
    const { sql, params } = parseBoolean("DVUP AND DSHS AND SCIS");
    // All three must be inside a single EXISTS block
    expect(norm(sql)).toContain("grp @> to_jsonb($1::text)");
    expect(norm(sql)).toContain("grp @> to_jsonb($2::text)");
    expect(norm(sql)).toContain("grp @> to_jsonb($3::text)");
    expect(params).toEqual(["DVUP", "DSHS", "SCIS"]);
    // Should only have one EXISTS
    expect((sql.match(/EXISTS/g) ?? []).length).toBe(1);
  });

  it("collects both tags in allTags", () => {
    const { allTags } = parseBoolean("DVUP AND DSHS");
    expect(allTags.sort()).toEqual(["DSHS", "DVUP"]);
  });
});

// ── Precedence: AND binds tighter than OR ─────────────────────────────────────

describe("operator precedence", () => {
  it("parses A AND B OR C as (A AND B) OR C", () => {
    const { sql, params } = parseBoolean("DVUP AND DSHS OR SCIS");
    // EXISTS handles the AND pair; then OR with SCIS
    expect(norm(sql)).toContain("EXISTS");
    expect(norm(sql)).toContain("OR");
    expect(params).toEqual(["DVUP", "DSHS", "SCIS"]);
  });

  it("parses A OR B AND C as A OR (B AND C)", () => {
    const { sql, params } = parseBoolean("SCIS OR DVUP AND DSHS");
    expect(norm(sql)).toContain("EXISTS");
    expect(norm(sql)).toContain("OR");
    expect(params).toEqual(["SCIS", "DVUP", "DSHS"]);
  });
});

// ── Parentheses ───────────────────────────────────────────────────────────────

describe("parentheses", () => {
  it("overrides default precedence: (A OR B) AND C falls back to independent checks", () => {
    // (A OR B) is an OR node, so collectAndTags returns null → fallback path
    const { sql, params } = parseBoolean("(DVUP OR DSHS) AND SCIS");
    expect(norm(sql)).toContain("OR");
    expect(norm(sql)).toContain("AND");
    expect(params).toEqual(["DVUP", "DSHS", "SCIS"]);
  });

  it("handles the canonical PRD example: (DVUP AND DSHS) OR SCIS", () => {
    const { sql, params, allTags } = parseBoolean("(DVUP AND DSHS) OR SCIS");
    expect(norm(sql)).toContain("EXISTS");
    expect(norm(sql)).toContain("OR");
    expect(params).toEqual(["DVUP", "DSHS", "SCIS"]);
    expect(allTags.sort()).toEqual(["DSHS", "DVUP", "SCIS"]);
  });

  it("handles nested parens", () => {
    const { params } = parseBoolean("((DVUP AND DSHS) OR SCIS)");
    expect(params).toEqual(["DVUP", "DSHS", "SCIS"]);
  });

  it("handles deeply nested parens", () => {
    const { params } = parseBoolean("(DSNS AND (DVUP OR DSHS))");
    // DSNS is the left operand of AND, so it is emitted first
    expect(params).toEqual(["DSNS", "DVUP", "DSHS"]);
  });
});

// ── Parameter ordering ────────────────────────────────────────────────────────

describe("parameter ordering", () => {
  it("assigns params left-to-right as they appear in the expression", () => {
    const { params } = parseBoolean("AAAA AND BBBB OR CCCC");
    expect(params[0]).toBe("AAAA");
    expect(params[1]).toBe("BBBB");
    expect(params[2]).toBe("CCCC");
  });
});

// ── allTags deduplication ─────────────────────────────────────────────────────

describe("allTags", () => {
  it("deduplicates a tag that appears more than once", () => {
    const { allTags } = parseBoolean("DSNS OR DSNS");
    expect(allTags).toHaveLength(1);
    expect(allTags).toContain("DSNS");
  });

  it("collects all unique tags from a complex expression", () => {
    const { allTags } = parseBoolean("(DVUP AND DSHS) OR (SCIS AND DVUP)");
    expect(allTags.sort()).toEqual(["DSHS", "DVUP", "SCIS"]);
  });
});

// ── Tokenizer errors ──────────────────────────────────────────────────────────

describe("tokenizer errors", () => {
  it("rejects a tag with digits", () => {
    // Tokenizer reads "DS" then hits "1" — reported as unexpected character
    expect(() => parseBoolean("DS1S")).toThrow(/unexpected character/i);
  });

  it("rejects a single-character word that is not a keyword", () => {
    expect(() => parseBoolean("A")).toThrow(/invalid genEd tag/i);
  });

  it("rejects a tag longer than 6 characters", () => {
    expect(() => parseBoolean("TOOLONG")).toThrow(/invalid genEd tag/i);
  });

  it("rejects symbols", () => {
    expect(() => parseBoolean("DSNS + DVUP")).toThrow(/unexpected character/i);
  });
});

// ── Parser errors ─────────────────────────────────────────────────────────────

describe("parser errors", () => {
  it("rejects an empty string", () => {
    expect(() => parseBoolean("")).toThrow(/empty/i);
  });

  it("rejects whitespace-only input", () => {
    expect(() => parseBoolean("   ")).toThrow(/empty/i);
  });

  it("rejects adjacent tags with no operator", () => {
    // After parsing DVUP, parser sees another TAG where it expects OR/AND/end
    expect(() => parseBoolean("DVUP DSHS")).toThrow();
  });

  it("rejects a leading AND", () => {
    expect(() => parseBoolean("AND DSNS")).toThrow(/operator/i);
  });

  it("rejects a trailing AND", () => {
    expect(() => parseBoolean("DSNS AND")).toThrow();
  });

  it("rejects a double operator", () => {
    expect(() => parseBoolean("DSNS AND OR DVUP")).toThrow();
  });

  it("rejects unmatched opening paren", () => {
    expect(() => parseBoolean("(DSNS AND DVUP")).toThrow(/RPAREN/i);
  });

  it("rejects unmatched closing paren", () => {
    expect(() => parseBoolean("DSNS AND DVUP)")).toThrow();
  });

  it("rejects empty parens", () => {
    expect(() => parseBoolean("()")).toThrow();
  });
});
