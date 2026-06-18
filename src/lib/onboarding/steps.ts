/**
 * Onboarding setup steps — pure derivation (no Svelte/DOM), so the same logic
 * powers the dashboard empty state, the Getting-started page, and unit tests.
 *
 * A "done" flag is computed from simple presence checks the caller gathers from
 * the stores (any transactions imported, any starting balance set, a plan with
 * sections, and at least one savings target).
 */

export interface SetupStepInput {
  /** Any transactions imported yet. */
  hasData: boolean;
  /** Any per-account starting balance set. */
  hasBalance: boolean;
  /** A section group with at least one section exists. */
  hasPlan: boolean;
  /** At least one `target` (savings goal) section exists. */
  hasGoal: boolean;
}

export interface SetupStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/** The ordered onboarding steps, with each step's done-state resolved. */
export function deriveSetupSteps(input: SetupStepInput): SetupStep[] {
  return [
    {
      key: 'import',
      label: 'Import your transactions',
      hint: 'Bring in a CSV bank export.',
      href: '#import',
      done: input.hasData
    },
    {
      key: 'balance',
      label: 'Set your starting balance',
      hint: 'So Liquid balance shows the real money in your accounts.',
      href: '#settings',
      done: input.hasBalance
    },
    {
      key: 'plan',
      label: 'Set up a monthly plan',
      hint: 'Split your income into sections.',
      href: '#plan',
      done: input.hasPlan
    },
    {
      key: 'goal',
      label: 'Add a savings goal',
      hint: 'Track progress toward a target.',
      href: '#plan',
      done: input.hasGoal
    }
  ];
}

export interface SetupProgress {
  done: number;
  total: number;
  pct: number;
  complete: boolean;
}

/** Progress summary over a set of steps. */
export function setupProgress(steps: SetupStep[]): SetupProgress {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, complete: total > 0 && done === total };
}
