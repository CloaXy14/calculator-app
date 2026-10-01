import { describe, it, expect } from 'vitest';
import {
  angleOf, convertAngle, evaluate, evaluateScientific, formatDisplay, PI, primeFactors,
  renderDms, renderEngineering, renderFraction, renderNumber,
} from './math';

// Expected values come from mathematical definitions; long constants were checked
// against Python's decimal/math modules (independent of decimal.js).
const show = (value: string) => formatDisplay(value);

describe('binary arithmetic', () => {
  it('keeps decimal precision and computes powers exactly', () => {
    expect(evaluate('0.1', '0.2', '+')).toBe('0.3');
    expect(evaluate('2', '3', '^')).toBe('8');
    expect(evaluate('2', '100', '^')).toBe('1.267650600228229401496703205376e+30'); // all 31 digits of 2^100, exact
    expect(show(evaluate('2', '100', '^'))).toBe('1.26765060022822940149670320538e+30');
  });

  it('carries guard digits beyond the 30 displayed digits', () => {
    const third = evaluate('1', '3', '/');
    expect(show(third)).toBe('0.' + '3'.repeat(30));
    expect(show(evaluate(third, '3', '*'))).toBe('1');
  });

  it('supports magnitudes up to 1e±9999 and rejects anything larger', () => {
    expect(evaluate('1e308', '1e308', '*')).toBe('1e+616');
    expect(evaluate('1e5000', '1e4999', '*')).toBe('1e+9999');
    expect(() => evaluate('1e9999', '10', '*')).toThrow();
    expect(evaluate('1e-9999', '10', '/')).toBe('0');
  });

  it('rejects invalid binary operations', () => {
    expect(() => evaluate('5', '0', '/')).toThrow('Division by zero');
    expect(() => evaluate('-1', '0.5', '^')).toThrow();
    expect(() => evaluate('Infinity', '1', '+')).toThrow();
  });

  it('takes the x-th root with the index first', () => {
    expect(evaluate('3', '8', 'root')).toBe('2');
    expect(evaluate('3', '-27', 'root')).toBe('-3');
    expect(() => evaluate('2', '-4', 'root')).toThrow();
    expect(() => evaluate('0', '5', 'root')).toThrow();
  });

  it('counts permutations and combinations of non-negative integers', () => {
    expect(evaluate('5', '2', 'nPr')).toBe('20');
    expect(evaluate('10', '0', 'nPr')).toBe('1');
    expect(evaluate('5', '2', 'nCr')).toBe('10');
    expect(evaluate('52', '5', 'nCr')).toBe('2598960');
    expect(() => evaluate('2', '3', 'nCr')).toThrow();
    expect(() => evaluate('5.5', '2', 'nCr')).toThrow();
    expect(() => evaluate('-1', '0', 'nPr')).toThrow();
  });
});

describe('scientific functions', () => {
  it('returns exact trigonometric values for common degree angles', () => {
    expect(evaluateScientific('30', 'sin', 'DEG')).toBe('0.5');
    expect(show(evaluateScientific('60', 'cos', 'DEG'))).toBe('0.5');
    expect(show(evaluateScientific('45', 'tan', 'DEG'))).toBe('1');
    expect(evaluateScientific('180', 'sin', 'DEG')).toBe('0');
    expect(evaluateScientific('90', 'cos', 'DEG')).toBe('0');
    expect(evaluateScientific('-90', 'sin', 'DEG')).toBe('-1');
    expect(show(evaluateScientific('390', 'sin', 'DEG'))).toBe('0.5');
    expect(() => evaluateScientific('90', 'tan', 'DEG')).toThrow();
    expect(() => evaluateScientific('270', 'tan', 'DEG')).toThrow();
  });

  it('treats radian rounding residue of π as zero', () => {
    expect(evaluateScientific(PI, 'sin', 'RAD')).toBe('0');
    expect(evaluateScientific(evaluate(PI, '2', '/'), 'cos', 'RAD')).toBe('0');
    expect(() => evaluateScientific(evaluate(PI, '2', '/'), 'tan', 'RAD')).toThrow();
    expect(evaluateScientific('1e-20', 'sin', 'RAD')).toBe('1e-20');
  });

  it('evaluates inverse trigonometry in the selected angle unit', () => {
    expect(show(evaluateScientific('0.5', 'asin', 'DEG'))).toBe('30');
    expect(show(evaluateScientific('1', 'atan', 'DEG'))).toBe('45');
    expect(show(evaluateScientific('-1', 'acos', 'RAD'))).toBe('3.14159265358979323846264338328');
    expect(() => evaluateScientific('2', 'asin', 'RAD')).toThrow();
    expect(() => evaluateScientific('1.5', 'acos', 'DEG')).toThrow();
  });

  it('evaluates hyperbolic functions and their inverses', () => {
    expect(show(evaluateScientific('1', 'sinh', 'DEG'))).toBe('1.1752011936438014568823818506');
    expect(evaluateScientific('0', 'cosh', 'RAD')).toBe('1');
    expect(evaluateScientific('0', 'tanh', 'RAD')).toBe('0');
    expect(evaluateScientific('0', 'asinh', 'RAD')).toBe('0');
    expect(evaluateScientific('1', 'acosh', 'RAD')).toBe('0');
    expect(() => evaluateScientific('0.5', 'acosh', 'RAD')).toThrow();
    expect(() => evaluateScientific('1', 'atanh', 'RAD')).toThrow();
  });

  it('evaluates logarithms and exponentials across the extended range', () => {
    expect(evaluateScientific('100', 'log', 'RAD')).toBe('2');
    expect(show(evaluateScientific('2', 'ln', 'RAD'))).toBe('0.693147180559945309417232121458');
    expect(show(evaluateScientific('1', 'exp', 'RAD'))).toBe('2.71828182845904523536028747135');
    expect(show(evaluateScientific('1000', 'exp', 'RAD'))).toBe('1.97007111401704699388887935224e+434');
    expect(evaluateScientific('9999', 'pow10', 'RAD')).toBe('1e+9999');
    expect(() => evaluateScientific('10000', 'pow10', 'RAD')).toThrow();
    expect(() => evaluateScientific('23100', 'exp', 'RAD')).toThrow();
    expect(() => evaluateScientific('0', 'log', 'RAD')).toThrow();
    expect(() => evaluateScientific('0', 'ln', 'RAD')).toThrow();
  });

  it('evaluates powers, roots, reciprocal and absolute value', () => {
    expect(evaluateScientific('12', 'square', 'RAD')).toBe('144');
    expect(evaluateScientific('3', 'cube', 'RAD')).toBe('27');
    expect(evaluateScientific('9', 'sqrt', 'RAD')).toBe('3');
    expect(show(evaluateScientific('2', 'sqrt', 'RAD'))).toBe('1.41421356237309504880168872421');
    expect(evaluateScientific('-8', 'cbrt', 'RAD')).toBe('-2');
    expect(evaluateScientific('4', 'reciprocal', 'RAD')).toBe('0.25');
    expect(evaluateScientific('-5', 'abs', 'RAD')).toBe('5');
    expect(() => evaluateScientific('-1', 'sqrt', 'RAD')).toThrow();
    expect(() => evaluateScientific('0', 'reciprocal', 'RAD')).toThrow();
  });

  it('computes factorials of integers up to the largest that fits below 1e10000', () => {
    expect(evaluateScientific('0', 'factorial', 'RAD')).toBe('1');
    expect(evaluateScientific('5', 'factorial', 'RAD')).toBe('120');
    expect(evaluateScientific('25', 'factorial', 'RAD')).toBe('15511210043330985984000000');
    expect(show(evaluateScientific('70', 'factorial', 'RAD'))).toBe('1.19785716699698917960727837217e+100');
    expect(evaluateScientific('3248', 'factorial', 'RAD')).toMatch(/e\+9997$/);
    expect(() => evaluateScientific('3249', 'factorial', 'RAD')).toThrow();
    expect(() => evaluateScientific('1e100', 'factorial', 'RAD')).toThrow();
    expect(() => evaluateScientific('3.5', 'factorial', 'RAD')).toThrow();
    expect(() => evaluateScientific('-1', 'factorial', 'RAD')).toThrow();
  });

  // Mutation-loop additions: each kills a surviving mutant from the first Stryker run.
  it('evaluates tanh and atanh away from zero', () => {
    expect(show(evaluateScientific('1', 'tanh', 'RAD'))).toBe('0.761594155955764888119458282605');
    expect(show(evaluateScientific('0.5', 'atanh', 'RAD'))).toBe('0.549306144334054845697622618461');
  });

  it('uses exact degree values only in degree mode', () => {
    expect(evaluateScientific('180', 'cos', 'DEG')).toBe('-1');
    expect(show(evaluateScientific('90', 'sin', 'RAD'))).toMatch(/^0\.893996663600557/);
    expect(() => evaluateScientific('1e10', 'sin', 'RAD')).toThrow('Math error');
  });
});

describe('number entry and formatting', () => {
  it('reads unfinished entries and rejects malformed text', () => {
    expect(formatDisplay('12.')).toBe('12');
    expect(formatDisplay('1.5e')).toBe('1.5');
    expect(formatDisplay('1.5e-')).toBe('1.5');
    expect(() => formatDisplay('abc')).toThrow();
  });

  it('switches to scientific notation below 1e-6', () => {
    expect(formatDisplay('0.000001')).toBe('0.000001');
    expect(formatDisplay('0.0000001')).toBe('1e-7');
    expect(evaluate('1e-9998', '10', '/')).toBe('1e-9999');
  });

  it('rejects permutations that choose more items than exist', () => {
    expect(() => evaluate('3', '5', 'nPr')).toThrow();
  });
});

// Display renderers and helpers used by the fx-991ES-style calculator.
describe('scientific display renderers', () => {
  it('renders Norm, Fix and Sci formats like the fx-991ES', () => {
    expect(renderNumber('0.005', { kind: 'norm', mode: 1 })).toEqual({ mantissa: '5', exponent: -3 });
    expect(renderNumber('0.01', { kind: 'norm', mode: 1 })).toEqual({ mantissa: '0.01', exponent: null });
    expect(renderNumber('0.000000002', { kind: 'norm', mode: 2 })).toEqual({ mantissa: '0.000000002', exponent: null });
    expect(renderNumber('2e-10', { kind: 'norm', mode: 2 })).toEqual({ mantissa: '2', exponent: -10 });
    expect(renderNumber('0', { kind: 'norm', mode: 1 })).toEqual({ mantissa: '0', exponent: null });
    expect(renderNumber('1e30', { kind: 'norm', mode: 1 })).toEqual({ mantissa: '1', exponent: 30 });
    expect(renderNumber('-0.0001', { kind: 'fix', places: 2 })).toEqual({ mantissa: '0.00', exponent: null });
    expect(renderNumber('-1.5', { kind: 'fix', places: 0 })).toEqual({ mantissa: '-2', exponent: null });
    expect(renderNumber('1e31', { kind: 'fix', places: 2 })).toEqual({ mantissa: '1', exponent: 31 });
    expect(renderNumber('1234', { kind: 'sci', digits: 3 })).toEqual({ mantissa: '1.23', exponent: 3 });
  });

  it('renders engineering notation with exponents in steps of three', () => {
    expect(renderEngineering('0.0123', 0)).toEqual({ mantissa: '12.3', exponent: -3 });
    expect(renderEngineering('0', 0)).toEqual({ mantissa: '0', exponent: 0 });
  });

  it('renders fractions up to ten characters, keeping the sign', () => {
    expect(renderFraction('-0.75', false)).toBe('-3⌟4');
    expect(renderFraction('-1.75', true)).toBe('-1⌟3⌟4');
    expect(renderFraction('0.75', true)).toBe('3⌟4');
    expect(renderFraction('2', false)).toBeNull();
    expect(renderFraction('0.123456789', false)).toBeNull();
    expect(renderFraction('1.41421356237309504880168872421', false)).toBeNull();
  });

  it('renders degrees, minutes and seconds', () => {
    expect(renderDms('-2.255')).toBe('-2°15\'18"');
    expect(renderDms('1.0001')).toBe('1°0\'0.36"');
    expect(() => renderDms('1e7')).toThrow();
  });

  it('factorizes like the fx-991ES, leaving factors above 999 in parentheses', () => {
    expect(primeFactors('2')).toBe('2');
    expect(primeFactors('997')).toBe('997');
    expect(primeFactors('1009')).toBe('(1009)');
    expect(primeFactors('1024')).toBe('2¹⁰');
    expect(primeFactors('9999999967')).toBe('(9999999967)');
    expect(() => primeFactors('1')).toThrow();
    expect(() => primeFactors('1e10')).toThrow();
    expect(() => primeFactors('2.5')).toThrow();
  });
});

describe('angle units', () => {
  it('converts between degrees, radians and grads', () => {
    expect(formatDisplay(convertAngle('90', 'DEG', 'GRA'))).toBe('100');
    expect(formatDisplay(convertAngle('200', 'GRA', 'DEG'))).toBe('180');
    expect(formatDisplay(convertAngle(PI, 'RAD', 'DEG'))).toBe('180');
    expect(convertAngle('1', 'RAD', 'RAD')).toBe('1');
  });

  it('returns polar angles in each unit and rejects the origin', () => {
    expect(formatDisplay(angleOf('-1', '0', 'DEG'))).toBe('180');
    expect(formatDisplay(angleOf('0', '-1', 'GRA'))).toBe('-100');
    expect(formatDisplay(angleOf('1', '1', 'RAD'))).toBe(formatDisplay(evaluate(PI, '4', '/')));
    expect(formatDisplay(angleOf('0', '1', 'DEG'))).toBe('90');
    expect(() => angleOf('0', '0', 'DEG')).toThrow();
  });

  it('uses exact values for multiples of 100 grads', () => {
    expect(evaluateScientific('200', 'cos', 'GRA')).toBe('-1');
    expect(evaluateScientific('-100', 'sin', 'GRA')).toBe('-1');
    expect(() => evaluateScientific('300', 'tan', 'GRA')).toThrow();
    expect(evaluateScientific('400', 'tan', 'GRA')).toBe('0');
    expect(formatDisplay(evaluateScientific('50', 'tan', 'GRA'))).toBe('1');
  });
});
