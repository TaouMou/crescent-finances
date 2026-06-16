/**
 * CSV shape detection: encoding (utf-8 vs latin1) and delimiter (, vs ;).
 * Pure functions over bytes/strings so they unit-test without a worker.
 *
 * Many European bank exports are latin1/windows-1252 with ';' delimiters and
 * comma decimals; North-American ones are utf-8 with ',' delimiters. We sniff
 * rather than assume so a user rarely has to touch the encoding control.
 */

export type Encoding = 'utf-8' | 'latin1';

/**
 * Decide the byte encoding. If the bytes are valid UTF-8 we trust that;
 * otherwise we fall back to latin1 (windows-1252), which never throws.
 */
export function detectEncoding(bytes: Uint8Array): Encoding {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return 'utf-8';
  } catch {
    return 'latin1';
  }
}

export function decodeBytes(bytes: Uint8Array, encoding: Encoding): string {
  // Browsers map the 'latin1' label to windows-1252, which round-trips the
  // accented characters common in European exports (é, è, ç, …).
  const text = new TextDecoder(encoding).decode(bytes);
  // Strip a UTF-8 BOM if present.
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const CANDIDATES = [';', ','] as const;
export type Delimiter = (typeof CANDIDATES)[number];

/**
 * Pick the delimiter by counting candidates on the first non-empty line and
 * choosing the most frequent. ';' wins ties (it is the unambiguous European
 * choice and never appears as a decimal separator).
 */
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  let best: Delimiter = ',';
  let bestCount = -1;
  for (const d of CANDIDATES) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount || (count === bestCount && d === ';')) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}
