/**
 * Heuristics that pre-fill the mapping step so a typical export needs no manual
 * wiring: match column headers to roles by name, and pick sensible number/date
 * defaults from the detected delimiter (';' strongly implies European format).
 */

import type { Delimiter } from './detect';
import type { NumberFormat } from './parse';

export interface GuessedMapping {
  date?: string;
  label?: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

const matchers: Array<{ role: keyof GuessedMapping; re: RegExp }> = [
  { role: 'date', re: /\b(date|datum|fecha)\b|date/i },
  { role: 'debit', re: /debit|debet|d.bit|withdraw|sortie/i },
  { role: 'credit', re: /credit|cr.dit|deposit|entr.e/i },
  { role: 'amount', re: /amount|montant|betrag|importe|valor|sum|value/i },
  { role: 'label', re: /libell|label|descript|narrat|memo|name|payee|details?|wording/i }
];

export function guessMapping(headers: string[]): GuessedMapping {
  const out: GuessedMapping = {};
  for (const { role, re } of matchers) {
    if (out[role]) continue;
    const hit = headers.find((h) => re.test(h));
    if (hit) out[role] = hit;
  }
  return out;
}

export function defaultsForDelimiter(delimiter: Delimiter): {
  dateFormat: string;
  numberFormat: NumberFormat;
} {
  return delimiter === ';'
    ? { dateFormat: 'dd/MM/yyyy', numberFormat: { decimal: ',', thousands: '.' } }
    : { dateFormat: 'yyyy-MM-dd', numberFormat: { decimal: '.', thousands: ',' } };
}
