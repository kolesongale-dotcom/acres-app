/**
 * ID generators for Acres Painting Co.
 *
 * Customers use Excel-style IDs: A001 .. A999, B001 .. Z999, AA001, AA002 ...
 * Estimates / Proposals use formatted numbers: EST-0001, PRO-0001.
 */

// Convert a column-letter prefix (A, B, ... Z, AA, AB ...) to a 1-based index.
// A=1, Z=26, AA=27, AB=28 ...
function lettersToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64); // 'A' === 65
  }
  return index;
}

// Convert a 1-based index back to column letters (Excel-style, no zero column).
function indexToLetters(index: number): string {
  let n = index;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Each customer ID is one letter-group + a 3-digit number (001-999).
 * Ordering is: letter-group index first, then numeric suffix.
 * We model the full ID as a single ordinal so we can find the max and add one.
 *   ordinal = (letterIndex - 1) * 999 + numericSuffix
 */
const NUMS_PER_LETTER = 999;

function customerIdToOrdinal(id: string): number | null {
  const match = /^([A-Z]+)(\d{3})$/.exec(id.trim().toUpperCase());
  if (!match) return null;
  const letterIndex = lettersToIndex(match[1]);
  const num = parseInt(match[2], 10);
  if (num < 1 || num > NUMS_PER_LETTER) return null;
  return (letterIndex - 1) * NUMS_PER_LETTER + num;
}

function ordinalToCustomerId(ordinal: number): string {
  const letterIndex = Math.floor((ordinal - 1) / NUMS_PER_LETTER) + 1;
  const num = ((ordinal - 1) % NUMS_PER_LETTER) + 1;
  return indexToLetters(letterIndex) + String(num).padStart(3, "0");
}

export function generateNextCustomerId(existingIds: string[]): string {
  let maxOrdinal = 0;
  for (const id of existingIds ?? []) {
    const ord = customerIdToOrdinal(id);
    if (ord !== null && ord > maxOrdinal) maxOrdinal = ord;
  }
  return ordinalToCustomerId(maxOrdinal + 1);
}

/**
 * Formatted numbers like EST-0001 / PRO-0001.
 * Finds the max numeric suffix among existing values sharing the prefix,
 * increments it, and zero-pads to 4 digits.
 */
export function generateFormattedNumber(
  prefix: string,
  existingNumbers: string[]
): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let max = 0;
  for (const value of existingNumbers ?? []) {
    const match = re.exec(value.trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}
