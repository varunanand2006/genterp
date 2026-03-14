/**
 * Boolean GenEd expression parser.
 *
 * Converts expressions like "(DVUP AND DSHS) OR SCIS" into parameterized SQL
 * that leverages the two-column gen_ed storage strategy:
 *
 *   gen_ed_tags TEXT[]  — GIN-indexed flat list, fast containment checks
 *   gen_ed_raw  JSONB   — original nested structure, AND co-occurrence checks
 *
 * AND semantics: both tags must appear in the SAME inner array in gen_ed_raw
 * (i.e., the course satisfies BOTH requirements as a pair, not just separately).
 *
 * Security: tag values are NEVER concatenated into SQL strings. All values are
 * collected into a params[] array and referenced as $1, $2, … positional params.
 */

// ── Public types ──────────────────────────────────────────────────────────────

export type BooleanAST =
  | { type: "tag"; value: string }
  | { type: "and"; left: BooleanAST; right: BooleanAST }
  | { type: "or"; left: BooleanAST; right: BooleanAST };

export interface ParsedExpression {
  /** Parameterized SQL fragment ready to embed in a WHERE clause */
  sql: string;
  /** Ordered values for $1, $2, … placeholders in sql */
  params: string[];
  /** Every unique tag mentioned — used for the GIN pre-filter */
  allTags: string[];
  /** The parsed AST — use with evaluateBoolean() for JS-side post-filtering */
  ast: BooleanAST;
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type Token =
  | { type: "TAG"; value: string }
  | { type: "AND" }
  | { type: "OR" }
  | { type: "LPAREN" }
  | { type: "RPAREN" };

const TAG_RE = /^[A-Z]{2,6}$/;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    if (ch === "(") { tokens.push({ type: "LPAREN" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "RPAREN" }); i++; continue; }

    // Read a contiguous alphabetic word
    if (/[A-Za-z]/.test(ch)) {
      let word = "";
      while (i < input.length && /[A-Za-z]/.test(input[i])) {
        word += input[i++];
      }
      const upper = word.toUpperCase();

      // Keywords take priority over tag validation
      if (upper === "AND") { tokens.push({ type: "AND" }); continue; }
      if (upper === "OR")  { tokens.push({ type: "OR"  }); continue; }

      if (!TAG_RE.test(upper)) {
        throw new Error(
          `Invalid GenEd tag: "${word}". Tags must be 2–6 uppercase letters (e.g. DSNS, DVUP).`
        );
      }
      tokens.push({ type: "TAG", value: upper });
      continue;
    }

    throw new Error(`Unexpected character: "${ch}"`);
  }

  return tokens;
}

// ── Recursive descent parser ──────────────────────────────────────────────────

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const tok = this.tokens[this.pos];
    if (!tok) throw new Error("Unexpected end of expression");
    this.pos++;
    return tok;
  }

  private expect(type: Token["type"]): void {
    const tok = this.peek();
    if (!tok)           throw new Error(`Expected ${type} but reached end of expression`);
    if (tok.type !== type) throw new Error(`Expected ${type} but got ${tok.type}`);
    this.consume();
  }

  // expression = term (OR term)*
  private parseExpression(): BooleanAST {
    let left = this.parseTerm();
    while (this.peek()?.type === "OR") {
      this.consume(); // eat OR
      const right = this.parseTerm();
      left = { type: "or", left, right };
    }
    return left;
  }

  // term = factor (AND factor)*
  private parseTerm(): BooleanAST {
    let left = this.parseFactor();
    while (this.peek()?.type === "AND") {
      this.consume(); // eat AND
      const right = this.parseFactor();
      left = { type: "and", left, right };
    }
    return left;
  }

  // factor = TAG | LPAREN expression RPAREN
  private parseFactor(): BooleanAST {
    const tok = this.peek();

    if (!tok) throw new Error("Expected a tag or '(' but reached end of expression");

    if (tok.type === "TAG") {
      this.consume();
      return { type: "tag", value: tok.value };
    }

    if (tok.type === "LPAREN") {
      this.consume(); // eat (
      const expr = this.parseExpression();
      this.expect("RPAREN"); // eat )
      return expr;
    }

    throw new Error(
      tok.type === "AND" || tok.type === "OR"
        ? `Operator "${tok.type}" must be between two tags or groups`
        : `Unexpected token: ${tok.type}`
    );
  }

  parse(): BooleanAST {
    if (this.tokens.length === 0) throw new Error("Expression cannot be empty");
    const ast = this.parseExpression();
    if (this.peek()) {
      throw new Error(
        `Unexpected token after expression: ${this.peek()!.type}. Did you forget an operator?`
      );
    }
    return ast;
  }
}

// ── SQL emitter ───────────────────────────────────────────────────────────────

/**
 * Tries to collect all leaf tag values from an AND subtree.
 * Returns null if the subtree contains an OR node (can't flatten into
 * a single co-occurrence check in that case).
 */
function collectAndTags(node: BooleanAST): string[] | null {
  if (node.type === "tag") return [node.value];
  if (node.type === "and") {
    const left  = collectAndTags(node.left);
    const right = collectAndTags(node.right);
    if (left === null || right === null) return null;
    return [...left, ...right];
  }
  // OR node — can't represent as a single co-occurrence group
  return null;
}

function astToSQL(node: BooleanAST, params: string[]): string {
  switch (node.type) {
    case "tag": {
      params.push(node.value);
      // GIN-indexed containment check on the flat tag array
      return `gen_ed_tags @> ARRAY[$${params.length}]::text[]`;
    }

    case "or": {
      const left  = astToSQL(node.left,  params);
      const right = astToSQL(node.right, params);
      return `(${left} OR ${right})`;
    }

    case "and": {
      const andTags = collectAndTags(node);

      if (andTags !== null) {
        // All leaves are plain tags: use a JSONB EXISTS co-occurrence check so
        // that all tags must appear in the SAME inner array (one GenEd group).
        const conditions = andTags.map((tag) => {
          params.push(tag);
          return `grp @> to_jsonb($${params.length}::text)`;
        });
        return (
          `EXISTS (` +
          `SELECT 1 FROM jsonb_array_elements(gen_ed_raw) AS grp ` +
          `WHERE ${conditions.join(" AND ")}` +
          `)`
        );
      }

      // Mixed AND/OR subtree — fall back to checking each side independently
      // (less semantically precise but always correct and safe)
      const left  = astToSQL(node.left,  params);
      const right = astToSQL(node.right, params);
      return `(${left} AND ${right})`;
    }
  }
}

function collectAllTags(node: BooleanAST): Set<string> {
  if (node.type === "tag") return new Set([node.value]);
  const left  = collectAllTags(node.left);
  const right = collectAllTags(node.right);
  return new Set([...left, ...right]);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parses a boolean GenEd expression and returns parameterized SQL.
 *
 * @throws {Error} with a human-readable message for any syntax error
 *
 * @example
 * parseBoolean("(DVUP AND DSHS) OR SCIS")
 * // {
 * //   sql:     "(EXISTS(...) OR gen_ed_tags @> ARRAY[$3]::text[])",
 * //   params:  ["DVUP", "DSHS", "SCIS"],
 * //   allTags: ["DVUP", "DSHS", "SCIS"]
 * // }
 */
export function parseBoolean(input: string): ParsedExpression {
  if (!input.trim()) throw new Error("Expression cannot be empty");

  const tokens = tokenize(input);
  const ast    = new Parser(tokens).parse();

  const params: string[] = [];
  const sql     = astToSQL(ast, params);
  const allTags = Array.from(collectAllTags(ast));

  return { sql, params, allTags, ast };
}

/**
 * Evaluates a parsed boolean AST against a course's gen_ed data in JavaScript.
 *
 * Mirrors the SQL semantics exactly:
 *   - OR  → either side matches
 *   - AND → all tags must appear in the SAME inner array in genEdRaw
 *           (co-occurrence check, same as the SQL EXISTS subquery)
 *
 * Used to post-filter the GIN pre-filter results client-side, since
 * PostgREST does not support arbitrary SQL in WHERE clauses.
 */
export function evaluateBoolean(ast: BooleanAST, genEdRaw: string[][]): boolean {
  switch (ast.type) {
    case "tag":
      return genEdRaw.some((group) => group.some((entry) => entry.split("|")[0].trim() === ast.value));

    case "or":
      return evaluateBoolean(ast.left, genEdRaw) || evaluateBoolean(ast.right, genEdRaw);

    case "and": {
      const andTags = collectAndTags(ast);
      if (andTags !== null) {
        // Co-occurrence: all tags must exist in the same inner array
        return genEdRaw.some((group) => {
          const normalized = group.map((e) => e.split("|")[0].trim());
          return andTags.every((tag) => normalized.includes(tag));
        });
      }
      // Mixed AND/OR subtree — check each side independently (fallback path)
      return evaluateBoolean(ast.left, genEdRaw) && evaluateBoolean(ast.right, genEdRaw);
    }
  }
}
