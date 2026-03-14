/**
 * Converts umd.io time strings to military time integers.
 *
 * "10:45am"  → 1045
 * "6:30pm"   → 1830
 * "12:00pm"  → 1200  (noon)
 * "12:30am"  → 0030  (past midnight)
 * null/undefined → null  (async/TBA)
 */
export function parseTimeToMilitary(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toLowerCase();

  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return hours * 100 + minutes;
}
