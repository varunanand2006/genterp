export interface SemesterOption {
  code: string;  // e.g. "202601"
  label: string; // e.g. "Spring 2026"
}

/**
 * Returns the three semester options to present based on the current date.
 * UMD codes: YYYYxx where xx = 01 (Spring), 05 (Summer), 08 (Fall), 12 (Winter)
 *
 * If current semester is Spring → [Spring, Summer, Fall]
 * If current semester is Fall   → [Fall, Winter, Spring+1]
 * Summer / Winter are treated as transition periods leaning toward the next main semester.
 */
export function getSemesterOptions(): [SemesterOption, SemesterOption, SemesterOption] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12

  const make = (y: number, suffix: "01" | "05" | "08" | "12", name: string): SemesterOption => ({
    code: `${y}${suffix}`,
    label: `${name} ${y}`,
  });

  if (month <= 5) {
    // Spring semester
    return [
      make(year, "01", "Spring"),
      make(year, "05", "Summer"),
      make(year, "08", "Fall"),
    ];
  } else if (month <= 7) {
    // Summer — upcoming fall is the main focus
    return [
      make(year, "05", "Summer"),
      make(year, "08", "Fall"),
      make(year, "12", "Winter"),
    ];
  } else if (month <= 11) {
    // Fall semester
    return [
      make(year, "08", "Fall"),
      make(year, "12", "Winter"),
      make(year + 1, "01", "Spring"),
    ];
  } else {
    // December — Winter
    return [
      make(year, "12", "Winter"),
      make(year + 1, "01", "Spring"),
      make(year + 1, "08", "Fall"),
    ];
  }
}

export function getDefaultSemesterCode(): string {
  return getSemesterOptions()[0].code;
}
