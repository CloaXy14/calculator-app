import Decimal from 'decimal.js';

export type AngleMode = 'DEG' | 'RAD';
export type ScientificOperation = 'sin' | 'cos' | 'tan' | 'log' | 'ln' | 'sqrt' | 'pow' | 'square' | 'reciprocal' | 'exp' | 'pow10';

const finite = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error('Result is not finite');
  return Object.is(value, -0) ? 0 : value;
};

export const evaluate = (a: number, b: number, operator: string): number => {
  const decA = new Decimal(finite(a));
  const decB = new Decimal(finite(b));
  let result: number;

  switch (operator) {
    case '+': result = decA.plus(decB).toNumber(); break;
    case '-': result = decA.minus(decB).toNumber(); break;
    case '*': result = decA.times(decB).toNumber(); break;
    case '/':
      if (b === 0) throw new Error('Division by zero');
      result = decA.dividedBy(decB).toNumber(); break;
    case '^': result = decA.toPower(decB).toNumber(); break;
    default: result = b;
  }
  return finite(result);
};

export const evaluateScientific = (
  value: number,
  operation: ScientificOperation,
  prevValue?: number,
  angleMode: AngleMode = 'RAD',
): number => {
  finite(value);
  const radians = angleMode === 'DEG' ? (value / 180) * Math.PI : value;
  let result: number;

  switch (operation) {
    case 'sin': result = Math.sin(radians); break;
    case 'cos': result = Math.cos(radians); break;
    case 'tan':
      if (Math.abs(Math.cos(radians)) < 1e-15) throw new Error('Invalid input');
      result = Math.tan(radians); break;
    case 'log':
      if (value <= 0) throw new Error('Invalid input');
      result = Math.log10(value); break;
    case 'ln':
      if (value <= 0) throw new Error('Invalid input');
      result = Math.log(value); break;
    case 'sqrt':
      if (value < 0) throw new Error('Invalid input');
      result = Math.sqrt(value); break;
    case 'pow': result = prevValue === undefined ? value : evaluate(prevValue, value, '^'); break;
    case 'square': result = evaluate(value, 2, '^'); break;
    case 'reciprocal': result = evaluate(1, value, '/'); break;
    case 'exp': result = Math.exp(value); break;
    case 'pow10': result = evaluate(10, value, '^'); break;
    default: result = value;
  }
  return finite(result);
};
