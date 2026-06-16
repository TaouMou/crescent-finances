import { describe, it, expect } from 'vitest';
import { emptyConfig, parseConfig, safeParseConfig, SCHEMA_VERSION } from '../../src/lib/config/schema';
import exampleConfig from '../../public/example.config.json';

describe('config schema', () => {
  it('emptyConfig is valid, seeds starter categories/rules, no sections/accounts', () => {
    const cfg = emptyConfig();
    expect(() => parseConfig(cfg)).not.toThrow();
    expect(cfg.sections).toHaveLength(0);
    expect(cfg.sectionGroups).toHaveLength(0);
    expect(cfg.accounts).toHaveLength(0);
    // Ships a starter set so a fresh vault is immediately usable.
    expect(cfg.categories.length).toBeGreaterThan(0);
    expect(cfg.rules.length).toBeGreaterThan(0);
    // Every starter rule points at a real starter category.
    const catIds = new Set(cfg.categories.map((c) => c.id));
    for (const r of cfg.rules) {
      if (r.setCategoryId) expect(catIds.has(r.setCategoryId)).toBe(true);
    }
    expect(cfg.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('validates the shipped example config', () => {
    const parsed = parseConfig(exampleConfig);
    expect(parsed.accounts.length).toBeGreaterThan(0);
    expect(parsed.sectionGroups[0].kind).toBe('distribution');
    expect(parsed.importProfiles[0].delimiter).toBe(';');
  });

  it('applies defaults for omitted optional fields', () => {
    const parsed = parseConfig({
      schemaVersion: 1,
      meta: { createdAt: '2026-01-01T00:00:00.000Z' }
    });
    expect(parsed.meta.currency).toBe('EUR');
    expect(parsed.settings.anomaly.baselineMonths).toBe(6);
    expect(parsed.categories).toEqual([]);
  });

  it('rejects a bad category color', () => {
    const res = safeParseConfig({
      schemaVersion: 1,
      meta: { createdAt: '2026-01-01T00:00:00.000Z' },
      categories: [{ id: 'c1', name: 'X', color: 'not-a-color', parentId: null }]
    });
    expect(res.success).toBe(false);
  });

  it('rejects an unknown section calc type', () => {
    const res = safeParseConfig({
      schemaVersion: 1,
      meta: { createdAt: '2026-01-01T00:00:00.000Z' },
      sections: [{ id: 's1', name: 'X', color: '#14776B', calc: { type: 'bogus' } }]
    });
    expect(res.success).toBe(false);
  });
});
