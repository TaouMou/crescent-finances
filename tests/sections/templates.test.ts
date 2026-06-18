import { describe, it, expect } from 'vitest';
import { planTemplates } from '../../src/lib/sections/templates';
import { emptyConfig, safeParseConfig } from '../../src/lib/config/schema';

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

  it('emergency fund is a target in a plain group', () => {
    const tpl = planTemplates.find((t) => t.id === 'emergency-fund')!;
    const built = tpl.build();
    expect(built.sectionGroups[0].kind).toBe('plain');
    expect(built.sections[0].calc.type).toBe('target');
    expect(tpl.openSectionAfter?.(built)).toBe(built.sections[0].id);
  });
});
