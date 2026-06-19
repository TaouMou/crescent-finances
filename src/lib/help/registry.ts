/**
 * In-app help content, keyed by route. Pure data (no Svelte/DOM) so it is easy
 * to review, test, and render from a single dumb panel. The right sidebar looks
 * up `pageHelp[route]` and renders it; copy lives here, not scattered in markup.
 *
 * Keep each body to a sentence or two, in plain language — this is the
 * documentation surface for a first-time user.
 */

export interface HelpSection {
  heading: string;
  body: string;
}

export interface HelpTerm {
  term: string;
  def: string;
}

export interface PageHelp {
  /** Shown as the panel heading. */
  title: string;
  /** One-paragraph "what this page is for". */
  intro: string;
  sections?: HelpSection[];
  /** Glossary of jargon used on the page. */
  terms?: HelpTerm[];
  /** A short worked example, rendered as a callout. */
  example?: string;
}

export const pageHelp: Record<string, PageHelp> = {
  start: {
    title: 'Getting started',
    intro:
      'A tour of how Crescent works plus one-click setups to copy. Reopen it any time from the sidebar.',
    sections: [
      {
        heading: 'The short version',
        body: 'Import a few recent months of bank CSV, set each account’s starting balance so totals match your bank, then let rules categorize and a plan organize your money.'
      }
    ]
  },

  dashboard: {
    title: 'Dashboard',
    intro:
      'A snapshot of your money for the selected date range. Change the range with the filters above.',
    sections: [
      {
        heading: 'Summary cards',
        body: 'Income, spending and net are for the selected range. Liquid balance is different: it’s the real money on hand — your account starting balances plus every transaction since — and ignores the range.'
      },
      {
        heading: 'Anomalies',
        body: 'We compare each category’s spending this month against the median of your last several months, and flag it only when it’s both meaningfully higher (by amount and percent) and an unusual spike — not just a normal wobble. Tune the sensitivity in Settings.'
      }
    ],
    terms: [
      { term: 'Liquid balance', def: 'Starting balances + all transactions since. What your bank should show.' },
      { term: 'Net', def: 'Income minus spending over the selected range.' },
      { term: 'Anomaly', def: 'A category whose spending this month is an unusual jump versus your recent norm.' }
    ]
  },

  transactions: {
    title: 'Transactions',
    intro: 'Every row you’ve imported. Sort, filter, and search to find anything.',
    sections: [
      {
        heading: 'How rows get categorized',
        body: 'Rules categorize and tag automatically on import (see the Rules page). You can also edit a row’s category by hand.'
      },
      {
        heading: 'No duplicates',
        body: 'Re-importing the same export is safe — each transaction has a fingerprint, so rows already present are skipped.'
      }
    ],
    terms: [
      { term: 'Entity', def: 'The merchant or payee a transaction is with (e.g. “ALDI”).' },
      { term: 'Category', def: 'A single spending bucket per transaction (e.g. Groceries).' },
      { term: 'Tag', def: 'A stackable label — a transaction can carry several (e.g. “Reimbursable”).' }
    ]
  },

  monthly: {
    title: 'Breakdown',
    intro: 'Income, spending and net for each month, so you can see the trend over time.',
    sections: [
      {
        heading: 'Reading it',
        body: 'Each month shows what came in, what went out, and the difference. A positive net means you saved that month.'
      }
    ]
  },

  plan: {
    title: 'Plan & Goals',
    intro:
      'Organize your money into a Budget (split your income into buckets) and Goals (track progress toward a target).',
    sections: [
      {
        heading: 'Budget vs Goals',
        body: 'A Budget group divides the period’s income across buckets. A Goal tracks how close you are to a savings target. One Plan can hold several of each.'
      },
      {
        heading: 'Planned vs actual',
        body: 'Percentage, fixed and remainder buckets are intents you set. A “tracked spending” bucket is measured from your real transactions, so you see actual against planned.'
      },
      {
        heading: 'Do the buckets need filling?',
        body: 'No. Budget buckets are a plan for your income — they’re calculated, not something you top up. Only Goals show real progress, and only when you link an account pool to them.'
      }
    ],
    terms: [
      { term: 'Source · Income', def: 'The period’s imported income — the amount being divided across buckets.' },
      { term: 'Remainder', def: 'A bucket that absorbs whatever income is left, keeping the budget at 100%.' },
      { term: 'Balanced · 100%', def: 'Your percentage buckets add up to all of your income (remainder fills the rest).' },
      { term: 'Goal progress', def: 'Read from a linked account pool’s balance. Without a linked pool it stays 0%.' }
    ],
    example:
      'Salary in → set aside Savings 15%, Investment 10%, Charity 5% → the Expenses remainder takes the other 70%.'
  },

  import: {
    title: 'Import',
    intro: 'CSV is the only way data gets in. Import a bank export to bring transactions into the vault.',
    sections: [
      {
        heading: 'How much to import',
        body: 'You don’t need your whole history — a few recent months is enough to start, and you can always add more later. To make balances match your bank, set account starting balances in Settings instead of importing years of data.'
      },
      {
        heading: 'Safe to repeat',
        body: 'Importing overlapping files won’t create duplicates; rows already in the vault are skipped.'
      }
    ]
  },

  rules: {
    title: 'Rules',
    intro:
      'Rules read each transaction and fill in details for you — set a category, rename the merchant, or add tags — so you categorize once instead of row by row.',
    sections: [
      {
        heading: 'What a rule matches',
        body: 'Pick a field (the description or the merchant), then match it by keyword (a substring) or a regex pattern. Matching rules set a category, set the entity, and/or add tags.'
      },
      {
        heading: 'Order matters',
        body: 'Rules run from lowest priority number first; later matching rules can stack more tags. Use “Apply now” to re-run all rules over transactions you already imported.'
      }
    ],
    terms: [
      { term: 'Keyword', def: 'Matches when the text contains this word, e.g. “ALDI”.' },
      { term: 'Regex', def: 'A pattern for advanced matching, e.g. “^NETFLIX” for descriptions that start with NETFLIX.' },
      { term: 'Priority', def: 'Lower numbers run first.' }
    ],
    example: 'When description contains “ALDI” → set category Groceries.'
  },

  settings: {
    title: 'Settings',
    intro: 'Set up the building blocks your transactions and plan rely on. Advanced options are tucked away until you need them.',
    sections: [
      {
        heading: 'Start here',
        body: 'Set your currency, add a few Categories and Accounts, and enter each account’s starting balance so Liquid balance matches your bank.'
      },
      {
        heading: 'Backups',
        body: 'A Config template is shareable plaintext with no money in it. An Encrypted backup contains your transactions too and needs its passphrase to restore.'
      }
    ],
    terms: [
      { term: 'Account pool', def: 'A group of accounts whose combined balance powers “balance” sections and goal progress.' },
      { term: 'Starting balance', def: 'What an account held on a chosen date; transactions are added on top of it.' }
    ]
  }
};
