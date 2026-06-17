/**
 * Built-in, code-shipped import presets for known bank CSV exports. Picking a
 * preset pre-fills the same format/mapping fields a user would otherwise wire by
 * hand (delimiter, date format, decimal/thousands, column roles). Presets are
 * intentionally not stored in AppConfig — they are versioned with the app and
 * always available. A user can still tweak the fields afterwards and "Save as
 * profile" to persist a normal ImportProfile.
 *
 * Mapping columns reference each bank's exact CSV header names.
 */

import type { Encoding } from './detect';
import type { LabelCleanupRule } from './parse';

export interface BankPreset {
  key: string;
  label: string;
  /** True until a real sample is available; surfaced but not selectable. */
  incomplete?: boolean;
  delimiter: ';' | ',';
  encoding: Encoding;
  hasHeader: boolean;
  dateFormat: string;
  decimal: string;
  thousands: string;
  mapping: {
    date: string;
    amount?: string;
    debit?: string;
    credit?: string;
    label: string;
    account?: string;
    category?: string;
    entity?: string;
  };
  /** Optional regex cleanup to derive entity when no clean-name column exists. */
  labelCleanup?: LabelCleanupRule[];
}

/** Strip French card-payment boilerplate (`CARTE 15/05/26 … CB*5767`). */
const CARD_BOILERPLATE: LabelCleanupRule[] = [
  { pattern: '^CARTE\\s+\\d{2}/\\d{2}/\\d{2}\\s+', replacement: '' },
  { pattern: '\\s*CB\\*\\d+\\s*$', replacement: '' }
];

export const BANK_PRESETS: BankPreset[] = [
  {
    key: 'boursobank',
    label: 'BoursoBank',
    delimiter: ';',
    encoding: 'utf-8',
    hasHeader: true,
    dateFormat: 'yyyy-MM-dd',
    decimal: ',',
    thousands: '',
    mapping: {
      date: 'dateOp',
      amount: 'amount',
      label: 'label',
      // BoursoBank ships a cleaned merchant name and its own category.
      entity: 'suggestedLabel',
      category: 'category'
    }
  },
  {
    key: 'revolut',
    label: 'Revolut',
    delimiter: ',',
    encoding: 'utf-8',
    hasHeader: true,
    // Revolut timestamps the date; the time tokens are parsed and discarded.
    dateFormat: 'yyyy-MM-dd HH:mm:ss',
    decimal: '.',
    thousands: '',
    mapping: {
      date: 'Started Date',
      amount: 'Amount',
      label: 'Description'
    }
  },
  {
    key: 'bnp',
    label: 'BNP Paribas (needs a sample)',
    incomplete: true,
    delimiter: ';',
    encoding: 'latin1',
    hasHeader: true,
    dateFormat: 'dd/MM/yyyy',
    decimal: ',',
    thousands: '.',
    // Placeholder mapping — finalize once a real BNP export is available.
    mapping: {
      date: 'Date',
      amount: 'Montant',
      label: 'Libelle'
    },
    labelCleanup: CARD_BOILERPLATE
  }
];

export function findBankPreset(key: string): BankPreset | undefined {
  return BANK_PRESETS.find((p) => p.key === key);
}
