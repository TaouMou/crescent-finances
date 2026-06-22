import { describe, it, expect } from 'vitest';
import { deriveSetupSteps, setupProgress } from '../../src/lib/onboarding/steps';

describe('deriveSetupSteps', () => {
  it('returns the four steps in a stable order', () => {
    const steps = deriveSetupSteps({
      hasData: false,
      hasBalance: false,
      hasPlan: false,
      hasGoal: false
    });
    expect(steps.map((s) => s.key)).toEqual(['import', 'balance', 'plan', 'goal']);
    expect(steps.every((s) => s.done === false)).toBe(true);
  });

  it('maps each input flag to the matching step done-state', () => {
    const steps = deriveSetupSteps({
      hasData: true,
      hasBalance: false,
      hasPlan: true,
      hasGoal: false
    });
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(byKey).toEqual({ import: true, balance: false, plan: true, goal: false });
  });

  it('points each step at its route', () => {
    const steps = deriveSetupSteps({
      hasData: false,
      hasBalance: false,
      hasPlan: false,
      hasGoal: false
    });
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.href]));
    expect(byKey).toEqual({
      import: '#import',
      balance: '#settings',
      plan: '#plan',
      goal: '#plan'
    });
  });
});

describe('setupProgress', () => {
  it('reports zero progress when nothing is done', () => {
    const steps = deriveSetupSteps({
      hasData: false,
      hasBalance: false,
      hasPlan: false,
      hasGoal: false
    });
    expect(setupProgress(steps)).toEqual({ done: 0, total: 4, pct: 0, complete: false });
  });

  it('rounds the percentage and flags completion', () => {
    const partial = setupProgress(
      deriveSetupSteps({ hasData: true, hasBalance: false, hasPlan: false, hasGoal: false })
    );
    expect(partial).toEqual({ done: 1, total: 4, pct: 25, complete: false });

    const all = setupProgress(
      deriveSetupSteps({ hasData: true, hasBalance: true, hasPlan: true, hasGoal: true })
    );
    expect(all).toEqual({ done: 4, total: 4, pct: 100, complete: true });
  });
});
