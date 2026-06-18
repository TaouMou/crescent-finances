/**
 * Starter plan templates. Pure builders (no Svelte/DOM) that produce ready-made
 * section groups + sections so a first-time user can set up a budget or a goal in
 * one click. The output is plain config data — identical in shape to what the
 * PlanView section editor produces — so it flows through the same validated
 * `persist()` path and passes the Zod schema unchanged.
 *
 * Money is integer minor units (cents). ids are random so applying a template
 * twice creates distinct entries.
 */

import type { Section, SectionGroup } from '$lib/types';

export interface PlanBuild {
  sectionGroups: SectionGroup[];
  sections: Section[];
}

export interface PlanTemplate {
  id: string;
  title: string;
  description: string;
  /** Build fresh config objects to merge into the existing config. */
  build(): PlanBuild;
  /**
   * Optional id of a section the caller should open in the editor right after
   * applying (e.g. so the user can set a goal amount). Resolved from `build()`.
   */
  openSectionAfter?: (built: PlanBuild) => string | undefined;
}

/** A 50/30/20 budget: Needs 50% + Wants 30% + Savings as the remainder (→ 100%). */
function buildBudget503020(): PlanBuild {
  const groupId = crypto.randomUUID();
  const group: SectionGroup = {
    id: groupId,
    name: 'Monthly plan',
    order: 0,
    kind: 'distribution',
    sectionIds: []
  };
  const sections: Section[] = [
    {
      id: crypto.randomUUID(),
      name: 'Needs',
      color: '#2B8AB5',
      groupId,
      order: 0,
      calc: { type: 'percentage', of: { kind: 'income' }, percent: 50 }
    },
    {
      id: crypto.randomUUID(),
      name: 'Wants',
      color: '#D4843A',
      groupId,
      order: 1,
      calc: { type: 'percentage', of: { kind: 'income' }, percent: 30 }
    },
    {
      id: crypto.randomUUID(),
      name: 'Savings',
      color: '#0DA882',
      groupId,
      order: 2,
      calc: { type: 'remainder' }
    }
  ];
  group.sectionIds = sections.map((s) => s.id);
  return { sectionGroups: [group], sections };
}

/** An Emergency fund: a Goals list with one savings target to fill in. */
function buildEmergencyFund(): PlanBuild {
  const groupId = crypto.randomUUID();
  const group: SectionGroup = {
    id: groupId,
    name: 'Goals',
    order: 0,
    kind: 'plain',
    sectionIds: []
  };
  const sections: Section[] = [
    {
      id: crypto.randomUUID(),
      name: 'Emergency fund',
      color: '#14776B',
      groupId,
      order: 0,
      // Default ~3 months of typical spending; user edits the amount after applying.
      calc: { type: 'target', targetAmount: 600_000 }
    }
  ];
  group.sectionIds = sections.map((s) => s.id);
  return { sectionGroups: [group], sections };
}

export const planTemplates: PlanTemplate[] = [
  {
    id: 'budget-50-30-20',
    title: '50 / 30 / 20 budget',
    description: 'Split income into Needs 50%, Wants 30%, and Savings (the rest). Always balances to 100%.',
    build: buildBudget503020
  },
  {
    id: 'emergency-fund',
    title: 'Emergency fund goal',
    description: 'A savings target to track toward a rainy-day fund. Set the amount, then link a pool for live progress.',
    build: buildEmergencyFund,
    openSectionAfter: (built) => built.sections[0]?.id
  }
];
