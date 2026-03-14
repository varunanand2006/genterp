/**
 * Flattens umd.io's nested gen_ed array into a deduplicated, sorted tag list.
 *
 * Input from umd.io:
 *   [["FSAR", "FSMA"], ["DSNS|CHEM131"]]
 *
 * Output for gen_ed_tags column:
 *   ["DSNS", "FSAR", "FSMA"]
 *
 * Pipe-separated conditions (e.g., "DSNS|CHEM131") are stripped to the tag
 * name only. The conditional relationship is preserved in gen_ed_raw.
 * Tags not matching /^[A-Z]{2,6}$/ are silently dropped.
 */
export function flattenGenEdTags(genEdRaw: string[][]): string[] {
  const tags = new Set<string>();

  for (const group of genEdRaw) {
    for (const entry of group) {
      // Strip pipe conditions: "DSNS|CHEM131" → "DSNS"
      const tag = entry.split("|")[0].trim();
      if (tag && /^[A-Z]{2,6}$/.test(tag)) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags).sort();
}
