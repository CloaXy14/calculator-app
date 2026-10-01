import {
  E, PI, angleOf, compare, convertAngle, evaluate, evaluateScientific, fromNumber, isInteger,
  negate, roundSignificant, toNumber,
} from '../utils/math';
import type { AngleMode, UnaryOperation } from '../utils/math';
import { CalcError } from './parser';
import type { Node, Statement } from './parser';
import type { Variable } from './tokens';

export interface EvalContext {
  angle: AngleMode;
  vars: Record<Variable, string>;
  ans: string;
  /** Uniform random number in [0, 1); injected so evaluation stays deterministic in tests. */
  random: () => number;
  /** Rnd(): rounds the way the current display format shows the value. */
  roundForDisplay: (value: string) => string;
}

export interface Outcome {
  value: string;
  /** Pol( and Rec( return two values, also stored in X and Y. */
  pair?: { labels: [string, string]; values: [string, string] };
  vars?: Partial<Record<Variable, string>>;
}

/** Numerical methods (∫, d/dx) are reported to 10 significant digits, like the fx-991ES. */
const NUMERIC_DIGITS = 10;

const guard = <T>(pos: number, run: () => T): T => {
  try {
    return run();
  } catch (error) {
    if (error instanceof CalcError) throw error;
    throw new CalcError('Math', pos);
  }
};

const ANGLE_UNITS = { drgD: 'DEG', drgR: 'RAD', drgG: 'GRA' } as const;
const ZERO = '0';

const withX = (ctx: EvalContext, x: string): EvalContext => ({ ...ctx, vars: { ...ctx.vars, X: x } });

// Gauss–Kronrod 7/15 nodes and weights (the fx-991ES integrates with Gauss–Kronrod).
const XGK = [0.99145537112081261, 0.94910791234275849, 0.8648644233597691, 0.74153118559939446,
  0.58608723546769115, 0.40584515137739718, 0.20778495500789848, 0];
const WGK = [0.022935322010529224, 0.063092092629978558, 0.10479001032225019, 0.14065325971552592,
  0.16900472663926791, 0.19035057806478542, 0.20443294007529889, 0.20948214108472782];
const WG = [0.1294849661688697, 0.27970539148927664, 0.38183005050511892, 0.4179591836734694];

const gaussKronrod = (f: (x: number) => number, a: number, b: number) => {
  const center = (a + b) / 2;
  const half = (b - a) / 2;
  const fc = f(center);
  let kronrod = WGK[7] * fc;
  let gauss = WG[3] * fc;
  for (let j = 0; j < 7; j++) {
    const dx = half * XGK[j];
    const sum = f(center - dx) + f(center + dx);
    kronrod += WGK[j] * sum;
    if (j % 2 === 1) gauss += WG[(j - 1) / 2] * sum;
  }
  return { value: kronrod * half, error: Math.abs((kronrod - gauss) * half) };
};

const integrate = (f: (x: number) => number, a: number, b: number, tolerance: number): number => {
  const pieces = [{ a, b, ...gaussKronrod(f, a, b) }];
  for (let round = 0; round < 2000; round++) {
    const total = pieces.reduce((sum, piece) => sum + piece.value, 0);
    const error = pieces.reduce((sum, piece) => sum + piece.error, 0);
    if (!Number.isFinite(total)) break;
    if (error <= Math.max(tolerance, 1e-14) * Math.max(1, Math.abs(total))) return total;
    pieces.sort((p, q) => q.error - p.error);
    const worst = pieces.shift()!;
    const middle = (worst.a + worst.b) / 2;
    pieces.push({ a: worst.a, b: middle, ...gaussKronrod(f, worst.a, middle) });
    pieces.push({ a: middle, b: worst.b, ...gaussKronrod(f, middle, worst.b) });
  }
  throw new Error('Integration did not converge');
};

/** Central difference with one Richardson step: error O(h⁴). */
const differentiate = (f: (x: string) => string, at: string): string => {
  const h = evaluate('1e-8', evaluate('1', evaluateScientific(at, 'abs'), '+'), '*');
  const central = (step: string) =>
    evaluate(evaluate(f(evaluate(at, step, '+')), f(evaluate(at, step, '-')), '-'), evaluate('2', step, '*'), '/');
  const coarse = central(h);
  const fine = central(evaluate(h, '2', '/'));
  return evaluate(evaluate(evaluate('4', fine, '*'), coarse, '-'), '3', '/');
};

export const evaluateNode = (node: Node, ctx: EvalContext): string => guard(node.pos, () => {
  switch (node.t) {
    case 'num': return evaluate(node.value, ZERO, '+');
    case 'dms': {
      const [degrees, minutes = '0', seconds = '0'] = node.parts;
      return evaluate(evaluate(degrees, evaluate(minutes, '60', '/'), '+'), evaluate(seconds, '3600', '/'), '+');
    }
    case 'var': return ctx.vars[node.name];
    case 'const':
      if (node.name === 'pi') return PI;
      if (node.name === 'e') return E;
      if (node.name === 'Ans') return ctx.ans;
      return String(Math.floor(ctx.random() * 1000) / 1000);
    case 'neg': return negate(evaluateNode(node.arg, ctx));
    case 'bin': return evaluate(evaluateNode(node.left, ctx), evaluateNode(node.right, ctx), node.op);
    case 'frac': {
      const fraction = evaluate(evaluateNode(node.num, ctx), evaluateNode(node.den, ctx), '/');
      return node.whole ? evaluate(evaluateNode(node.whole, ctx), fraction, '+') : fraction;
    }
    case 'post': {
      const x = evaluateNode(node.arg, ctx);
      switch (node.op) {
        case 'sq': return evaluateScientific(x, 'square');
        case 'cube': return evaluateScientific(x, 'cube');
        case 'inv': return evaluateScientific(x, 'reciprocal');
        case 'fact': return evaluateScientific(x, 'factorial');
        case 'pct': return evaluate(x, '100', '/');
        default: return convertAngle(x, ANGLE_UNITS[node.op], ctx.angle);
      }
    }
    case 'fn': return evaluateFunction(node, ctx);
  }
});

const evaluateFunction = (node: Extract<Node, { t: 'fn' }>, ctx: EvalContext): string => {
  const arg = (index: number) => evaluateNode(node.args[index], ctx);
  switch (node.name) {
    case 'log(': {
      if (node.args.length === 1) return evaluateScientific(arg(0), 'log');
      const base = arg(0);
      if (compare(base, '1') === 0) throw new Error('log base 1');
      return evaluate(evaluateScientific(arg(1), 'ln'), evaluateScientific(base, 'ln'), '/');
    }
    case 'rnd(': return ctx.roundForDisplay(arg(0));
    case 'ranint(': {
      const low = arg(0); const high = arg(1);
      if (!isInteger(low) || !isInteger(high) || compare(low, high) > 0) throw new Error('RanInt# range');
      const span = toNumber(evaluate(evaluate(high, low, '-'), '1', '+'));
      return evaluate(low, String(Math.floor(ctx.random() * span)), '+');
    }
    case 'integral(': {
      const [body] = node.args;
      const f = (x: number) => toNumber(evaluateNode(body, withX(ctx, fromNumber(x))));
      const tolerance = node.args[3] ? toNumber(arg(3)) : 1e-10;
      return roundSignificant(fromNumber(integrate(f, toNumber(arg(1)), toNumber(arg(2)), tolerance)), NUMERIC_DIGITS);
    }
    case 'diff(': {
      const [body] = node.args;
      return roundSignificant(differentiate(x => evaluateNode(body, withX(ctx, x)), arg(1)), NUMERIC_DIGITS);
    }
    case 'sum(': {
      const [body] = node.args;
      const from = arg(1); const to = arg(2);
      if (!isInteger(from) || !isInteger(to) || compare(from, to) > 0) throw new Error('Σ range');
      const count = toNumber(evaluate(to, from, '-'));
      if (count > 100000) throw new Error('Σ range too large');
      let total = ZERO;
      for (let k = 0; k <= count; k++) total = evaluate(total, evaluateNode(body, withX(ctx, evaluate(from, String(k), '+'))), '+');
      return total;
    }
    case 'pol(': case 'rec(':
      throw new CalcError('Syntax', node.pos); // only valid as a whole statement
    default:
      return evaluateScientific(arg(0), node.name.slice(0, -1) as UnaryOperation, ctx.angle);
  }
};

const coordinates = (node: Extract<Node, { t: 'fn' }>, ctx: EvalContext): Outcome => guard(node.pos, () => {
  const a = evaluateNode(node.args[0], ctx);
  const b = evaluateNode(node.args[1], ctx);
  if (node.name === 'pol(') {
    const r = evaluateScientific(evaluate(evaluateScientific(a, 'square'), evaluateScientific(b, 'square'), '+'), 'sqrt');
    const theta = angleOf(a, b, ctx.angle);
    return { value: r, pair: { labels: ['r', 'θ'], values: [r, theta] }, vars: { X: r, Y: theta } };
  }
  const x = evaluate(a, evaluateScientific(b, 'cos', ctx.angle), '*');
  const y = evaluate(a, evaluateScientific(b, 'sin', ctx.angle), '*');
  return { value: x, pair: { labels: ['X', 'Y'], values: [x, y] }, vars: { X: x, Y: y } };
});

/** Evaluates one statement after = (equations are only valid in CALC and SOLVE). */
export const evaluateStatement = (statement: Statement, ctx: EvalContext): Outcome => {
  if (statement.right) throw new CalcError('Syntax', 0);
  const { left } = statement;
  if (left.t === 'fn' && (left.name === 'pol(' || left.name === 'rec(')) return coordinates(left, ctx);
  return { value: evaluateNode(left, ctx) };
};

/** CALC: "V=expr" assigns to V; anything else is evaluated. */
export const evaluateCalc = (statement: Statement, ctx: EvalContext): Outcome => {
  if (!statement.right) return evaluateStatement(statement, ctx);
  if (statement.left.t !== 'var') throw new CalcError('Syntax', statement.left.pos);
  const value = evaluateNode(statement.right, ctx);
  return { value, vars: { [statement.left.name]: value } };
};

/** SOLVE: Newton's method on left − right for X, starting from the current X. */
export const solve = (statement: Statement, ctx: EvalContext): { x: string; leftMinusRight: string } => {
  const residual = (x: string) => {
    const scoped = withX(ctx, x);
    const left = evaluateNode(statement.left, scoped);
    return statement.right ? evaluate(left, evaluateNode(statement.right, scoped), '-') : left;
  };
  let x = ctx.vars.X;
  for (let iteration = 0; iteration < 200; iteration++) {
    let fx: string;
    let slope: string;
    try {
      fx = residual(x);
      if (compare(fx, ZERO) === 0) return { x, leftMinusRight: ZERO };
      slope = differentiate(residual, x);
    } catch {
      break;
    }
    if (compare(slope, ZERO) === 0) { x = evaluate(x, '0.001', '+'); continue; }
    const step = evaluate(fx, slope, '/');
    x = evaluate(x, step, '-');
    const scale = evaluate('1', evaluateScientific(x, 'abs'), '+');
    if (compare(evaluateScientific(step, 'abs'), evaluate(scale, '1e-26', '*')) <= 0) {
      return { x, leftMinusRight: residual(x) };
    }
  }
  throw new CalcError("Can't Solve", 0);
};
