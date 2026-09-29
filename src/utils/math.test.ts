import { describe, it, expect } from 'vitest';
import { evaluate, evaluateScientific } from './math';

describe('Math functions', () => {
  it('preserves decimal precision and power calculations', () => {
    expect(evaluate(0.1, 0.2, '+')).toBe(0.3);
    expect(evaluate(2, 3, '^')).toBe(8);
    expect(evaluateScientific(3, 'pow', 2)).toBe(8);
  });

  it('supports degree and radian trigonometry', () => {
    expect(evaluateScientific(Math.PI / 2, 'sin')).toBeCloseTo(1);
    expect(evaluateScientific(30, 'sin', undefined, 'DEG')).toBeCloseTo(0.5);
    expect(evaluateScientific(60, 'cos', undefined, 'DEG')).toBeCloseTo(0.5);
    expect(evaluateScientific(45, 'tan', undefined, 'DEG')).toBeCloseTo(1);
    expect(() => evaluateScientific(90, 'tan', undefined, 'DEG')).toThrow();
  });

  it('evaluates the handheld scientific operations', () => {
    expect(evaluateScientific(12, 'square')).toBe(144);
    expect(evaluateScientific(4, 'reciprocal')).toBe(0.25);
    expect(evaluateScientific(1, 'exp')).toBe(Math.E);
    expect(evaluateScientific(3, 'pow10')).toBe(1000);
    expect(evaluateScientific(100, 'log')).toBe(2);
    expect(evaluateScientific(Math.E, 'ln')).toBe(1);
    expect(evaluateScientific(9, 'sqrt')).toBe(3);
  });

  it('rejects invalid domains and non-finite results', () => {
    expect(() => evaluate(5, 0, '/')).toThrow('Division by zero');
    expect(() => evaluate(1e308, 1e308, '*')).toThrow();
    expect(() => evaluate(-1, 0.5, '^')).toThrow();
    expect(() => evaluate(Infinity, 1, '+')).toThrow();
    expect(() => evaluateScientific(-1, 'sqrt')).toThrow();
    expect(() => evaluateScientific(0, 'ln')).toThrow();
    expect(() => evaluateScientific(0, 'log')).toThrow();
    expect(() => evaluateScientific(0, 'reciprocal')).toThrow();
    expect(() => evaluateScientific(1000, 'exp')).toThrow();
    expect(() => evaluateScientific(309, 'pow10')).toThrow();
  });
});
