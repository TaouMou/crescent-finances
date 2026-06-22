import { describe, it, expect } from 'vitest';
import { planTemplates } from '../../src/lib/sections/templates';
import { emptyConfig, safeParseConfig } from '../../src/lib/config/schema';
import { evaluateDistribution } from '../../src/lib/sections/engine';

describe('plan templates', () => {
  it('exposes the 50/30/20 budget and emergency fund', () => {
    const ids = planTemplates.map((t) => t.id);
    expect(ids).toContain('budget-50-30-20');
    expect(ids).toContain('emergency-fund');
  });

  for (const t of planTemplates) {
    describe(t.id, () => {
      it('builds config that passes the schema when merged', () => {
        const built = t.build();
        const next = {
          ...emptyConfig(),
          sectionGroups: built.sectionGroups,
          sections: built.sections
        };
        const parsed = safeParseConfig(next);
        expect(parsed.success).toBe(true);
      });

      it('back-references every section from its group', () => {
        const built = t.build();
        const sectionIds = new Set(built.sections.map((s) => s.id));
        for (const g of built.sectionGroups) {
          for (const id of g.sectionIds) expect(sectionIds.has(id)).toBe(true);
        }
        // every section points at a real group
        const groupIds = new Set(built.sectionGroups.map((g) => g.id));
        for (const s of built.sections) expect(groupIds.has(s.groupId as string)).toBe(true);
      });

      it('produces unique ids on each build', () => {
        const a = t.build();
        const b = t.build();
        expect(a.sectionGroups[0].id).not.toBe(b.sectionGroups[0].id);
      });
    });
  }

  it('50/30/20 uses percentage buckets plus a remainder', () => {
    const built = planTemplates.find((t) => t.id === 'budget-50-30-20')!.build();
    const types = built.sections.map((s) => s.calc.type).sort();
    expect(types).toEqual(['percentage', 'percentage', 'remainder']);
    expect(built.sectionGroups[0].kind).toBe('distribution');
  });

  it('salary-split has three percentage buckets summing to 30% plus a remainder', () => {
    const built = planTemplates.find((t) => t.id === 'salary-split')!.build();
    expect(built.sectionGroups[0].kind).toBe('distribution');
    const pct = built.sections
      .filter((s) => s.calc.type === 'percentage')
      .reduce((sum, s) => sum + (s.calc.type === 'percentage' ? s.calc.percent : 0), 0);
    expect(pct).toBe(30);
    expect(built.sections.filter((s) => s.calc.type === 'remainder')).toHaveLength(1);
  });

  it('salary-split distributes a full salary across the four buckets', () => {
    const built = planTemplates.find((t) => t.id === 'salary-split')!.build();
    const income = 300_000; // €3000
    const txs = [
      { id: 't1', amount: income, date: '2026-01-25' } as never
    ];
    const dist = evaluateDistribution(built.sectionGroups[0], built.sections, txs, []);
    const planned = Object.fromEntries(dist.sections.map((s) => [s.name, s.planned]));
    expect(planned['Savings']).toBe(45_000); // 15%
    expect(planned['Investment']).toBe(30_000); // 10%
    expect(planned['Charity']).toBe(15_000); // 5%
    expect(planned['Expenses']).toBe(210_000); // remainder (70%)
    const total = dist.sections.reduce((s, x) => s + x.planned, 0);
    expect(total).toBe(income);
  });

  it('track-category is a single tracked bucket with a planned cap', () => {
    const tpl = planTemplates.find((t) => t.id === 'track-category')!;
    const built = tpl.build();
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].calc.type).toBe('filterSum');
    expect(tpl.openSectionAfter?.(built)).toBe(built.sections[0].id);
  });

  it('emergency fund is a target in a plain group', () => {
    const tpl = planTemplates.find((t) => t.id === 'emergency-fund')!;
    const built = tpl.build();
    expect(built.sectionGroups[0].kind).toBe('plain');
    expect(built.sections[0].calc.type).toBe('target');
    expect(tpl.openSectionAfter?.(built)).toBe(built.sections[0].id);
  });
});
