import { describe, it, expect } from 'vitest';
import { pageHelp } from '../../src/lib/help/registry';

// Mirrors the routes in App.svelte's `titles` map. If a route is added there,
// add help for it here too — this test guards against drift.
const ROUTES = ['start', 'dashboard', 'transactions', 'monthly', 'plan', 'import', 'rules', 'settings'];

describe('pageHelp registry', () => {
  it('has an entry for every app route', () => {
    for (const r of ROUTES) {
      expect(pageHelp[r], `missing help for "${r}"`).toBeDefined();
    }
  });

  it('every entry has a non-empty title and intro', () => {
    for (const [route, help] of Object.entries(pageHelp)) {
      expect(help.title.trim(), `${route} title`).not.toBe('');
      expect(help.intro.trim(), `${route} intro`).not.toBe('');
    }
  });

  it('no section, term, or example is empty', () => {
    for (const [route, help] of Object.entries(pageHelp)) {
      for (const s of help.sections ?? []) {
        expect(s.heading.trim(), `${route} section heading`).not.toBe('');
        expect(s.body.trim(), `${route} section body`).not.toBe('');
      }
      for (const t of help.terms ?? []) {
        expect(t.term.trim(), `${route} term`).not.toBe('');
        expect(t.def.trim(), `${route} term def`).not.toBe('');
      }
      if (help.example !== undefined) {
        expect(help.example.trim(), `${route} example`).not.toBe('');
      }
    }
  });
});
