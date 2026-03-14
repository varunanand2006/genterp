import { describe, it, expect } from "vitest";
import { flattenGenEdTags } from "./gen-ed-flattener";

describe("flattenGenEdTags", () => {
  // Basic flattening
  it("flattens a nested string[][] into a sorted array", () => {
    expect(flattenGenEdTags([["FSAR", "FSMA"], ["DSNS"]])).toEqual([
      "DSNS",
      "FSAR",
      "FSMA",
    ]);
  });

  // Pipe-condition stripping
  it("strips pipe conditions — keeps only the tag", () => {
    expect(flattenGenEdTags([["DSNS|CHEM131"]])).toEqual(["DSNS"]);
  });

  it("handles multiple pipe conditions in the same group", () => {
    expect(flattenGenEdTags([["DSNS|CHEM131", "FSAR|ENGL101"]])).toEqual([
      "DSNS",
      "FSAR",
    ]);
  });

  // Deduplication
  it("deduplicates tags that appear in multiple groups", () => {
    expect(flattenGenEdTags([["DSNS"], ["DSNS", "FSAR"]])).toEqual([
      "DSNS",
      "FSAR",
    ]);
  });

  it("deduplicates a tag that appears once raw and once with a pipe", () => {
    expect(flattenGenEdTags([["DSNS"], ["DSNS|CHEM131"]])).toEqual(["DSNS"]);
  });

  // Sorting
  it("returns tags in alphabetical order", () => {
    expect(flattenGenEdTags([["SCIS", "DSHS", "DVUP"]])).toEqual([
      "DSHS",
      "DVUP",
      "SCIS",
    ]);
  });

  // Validation — invalid tags are dropped
  it("drops lowercase tags", () => {
    expect(flattenGenEdTags([["dsns", "FSAR"]])).toEqual(["FSAR"]);
  });

  it("drops tags with numbers", () => {
    expect(flattenGenEdTags([["DS1S", "FSAR"]])).toEqual(["FSAR"]);
  });

  it("drops tags shorter than 2 characters", () => {
    expect(flattenGenEdTags([["A", "FSAR"]])).toEqual(["FSAR"]);
  });

  it("drops tags longer than 6 characters", () => {
    expect(flattenGenEdTags([["TOOLONG", "FSAR"]])).toEqual(["FSAR"]);
  });

  it("drops empty strings after trimming", () => {
    expect(flattenGenEdTags([["  ", "FSAR"]])).toEqual(["FSAR"]);
  });

  // Edge cases
  it("returns an empty array for an empty input", () => {
    expect(flattenGenEdTags([])).toEqual([]);
  });

  it("returns an empty array when all entries are invalid", () => {
    expect(flattenGenEdTags([["bad", "123"]])).toEqual([]);
  });

  // Real-world example from umd.io
  it("handles a realistic umd.io gen_ed payload", () => {
    const input = [["FSAR", "FSMA"], ["DSNS|CHEM131"], ["DVUP"]];
    expect(flattenGenEdTags(input)).toEqual(["DSNS", "DVUP", "FSAR", "FSMA"]);
  });
});
