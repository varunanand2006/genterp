import { describe, it, expect } from "vitest";
import { parseTimeToMilitary } from "./time-parser";

describe("parseTimeToMilitary", () => {
  // Standard cases
  it("converts a morning time", () => {
    expect(parseTimeToMilitary("10:45am")).toBe(1045);
  });

  it("converts an afternoon time", () => {
    expect(parseTimeToMilitary("6:30pm")).toBe(1830);
  });

  it("converts a single-digit hour pm", () => {
    expect(parseTimeToMilitary("1:00pm")).toBe(1300);
  });

  // Noon / midnight edge cases
  it("12:00pm → 1200 (noon)", () => {
    expect(parseTimeToMilitary("12:00pm")).toBe(1200);
  });

  it("12:30pm → 1230 (half past noon)", () => {
    expect(parseTimeToMilitary("12:30pm")).toBe(1230);
  });

  it("12:00am → 0 (midnight)", () => {
    expect(parseTimeToMilitary("12:00am")).toBe(0);
  });

  it("12:30am → 30 (half past midnight)", () => {
    expect(parseTimeToMilitary("12:30am")).toBe(30);
  });

  // Case insensitivity
  it("handles uppercase AM/PM", () => {
    expect(parseTimeToMilitary("8:00AM")).toBe(800);
    expect(parseTimeToMilitary("3:15PM")).toBe(1515);
  });

  // Null / undefined / TBA
  it("returns null for null", () => {
    expect(parseTimeToMilitary(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseTimeToMilitary(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseTimeToMilitary("")).toBeNull();
  });

  // Malformed strings
  it("returns null for TBA", () => {
    expect(parseTimeToMilitary("TBA")).toBeNull();
  });

  it("returns null for a bare number", () => {
    expect(parseTimeToMilitary("1045")).toBeNull();
  });

  it("returns null for military-style input without am/pm", () => {
    expect(parseTimeToMilitary("10:45")).toBeNull();
  });
});
