import Decimal from 'decimal.js';

export type AngleMode = 'DEG' | 'RAD' | 'GRA';
export type BinaryOperator = '+' | '-' | '*' | '/' | '^' | 'root' | 'nPr' | 'nCr';
export type UnaryOperation =
  | 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan'
  | 'sinh' | 'cosh' | 'tanh' | 'asinh' | 'acosh' | 'atanh'
  | 'log' | 'ln' | 'pow10' | 'exp'
  | 'sqrt' | 'cbrt' | 'square' | 'cube' | 'reciprocal' | 'factorial' | 'abs';

export const DISPLAY_DIGITS = 30;
export const INPUT_DIGITS = 30;
/** Extra guard digits so results like 1 ÷ 3 × 3 display as 1, as on hardware calculators. */
const INTERNAL_DIGITS = 34;
const MAX_EXPONENT = 9999;

// Results beyond 1e±9999 become Infinity (overflow error) or 0 (underflow).
const Dec = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpPos: DISPLAY_DIGITS,
  toExpNeg: -7,
  maxE: MAX_EXPONENT,
  minE: -MAX_EXPONENT,
});

const PI_DEC = Dec.acos(-1);
export const PI = PI_DEC.toSignificantDigits(INTERNAL_DIGITS).toString();
export const E = Dec.exp(1).toSignificantDigits(INTERNAL_DIGITS).toString();

const fail = (message = 'Math error'): never => { throw new Error(message); };

/** Parses calculator entry text, including unfinished forms like "12." and "1.5e". */
const parse = (value: string): Decimal => {
  const text = value.replace(/e-?$/, '');
  let parsed: Decimal;
  try { parsed = new Dec(text); } catch { return fail(); }
  return checked(parsed);
};

const checked = (value: Decimal): Decimal => {
  if (!value.isFinite()) fail();
  return value.isZero() ? new Dec(0) : value;
};

const store = (value: Decimal): string => checked(value).toSignificantDigits(INTERNAL_DIGITS).toString();

export const formatDisplay = (value: string): string => parse(value).toSignificantDigits(DISPLAY_DIGITS).toString();

const nonNegativeInteger = (value: Decimal): Decimal => (value.isInteger() && !value.isNegative() ? value : fail());

const factorial = (n: Decimal): Decimal => {
  nonNegativeInteger(n);
  if (n.gt(3300)) fail(); // 3249! already exceeds 1e9999
  let result = new Dec(1);
  for (let i = 2; i <= n.toNumber(); i++) result = result.times(i);
  return result;
};

const permutations = (n: Decimal, r: Decimal): Decimal => {
  nonNegativeInteger(n); nonNegativeInteger(r);
  if (r.gt(n)) fail();
  if (r.gt(3300)) fail(); // nPr >= r!, which overflows here
  let result = new Dec(1);
  for (let i = 0; i < r.toNumber() && result.isFinite(); i++) result = result.times(n.minus(i));
  return result;
};

const combinations = (n: Decimal, r: Decimal): Decimal => {
  nonNegativeInteger(n); nonNegativeInteger(r);
  if (r.gt(n)) fail();
  const k = Decimal.min(r, n.minus(r));
  if (k.gt(17000)) fail(); // nCr >= C(2k, k) > 4^k / 2k, which overflows here
  let result = new Dec(1);
  for (let i = 1; i <= k.toNumber() && result.isFinite(); i++) result = result.times(n.minus(k).plus(i)).dividedBy(i);
  return result.lt('1e34') ? result.round() : result;
};

const root = (index: Decimal, radicand: Decimal): Decimal => {
  if (index.isZero()) fail();
  if (!radicand.isNegative()) return Dec.pow(radicand, new Dec(1).dividedBy(index));
  const oddInteger = index.isInteger() && index.mod(2).abs().eq(1);
  return oddInteger ? Dec.pow(radicand.abs(), new Dec(1).dividedBy(index)).negated() : fail();
};

export const evaluate = (a: string, b: string, operator: BinaryOperator): string => {
  const x = parse(a);
  const y = parse(b);
  switch (operator) {
    case '+': return store(x.plus(y));
    case '-': return store(x.minus(y));
    case '*': return store(x.times(y));
    case '/': return y.isZero() ? fail('Division by zero') : store(x.dividedBy(y));
    case '^': return store(Dec.pow(x, y));
    case 'root': return store(root(x, y));
    case 'nPr': return store(permutations(x, y));
    case 'nCr': return store(combinations(x, y));
  }
};

/** Snaps the rounding residue of π multiples (e.g. sin π ≈ 1e-34) to an exact zero. */
const snap = (result: Decimal, input: Decimal): Decimal =>
  input.abs().gte('1e-16') && result.abs().lt(Decimal.max(1, input.abs()).times('1e-30')) ? new Dec(0) : result;

/** Units per right angle; RAD has no exact table. */
const RIGHT_ANGLE: Record<AngleMode, number> = { DEG: 90, GRA: 100, RAD: 0 };

const exactAngle = (value: Decimal, mode: AngleMode, operation: 'sin' | 'cos' | 'tan'): Decimal | null => {
  const right = RIGHT_ANGLE[mode];
  const turn = value.mod(right * 4);
  const angle = turn.isNegative() ? turn.plus(right * 4) : turn;
  if (!angle.mod(right).isZero()) return null;
  const quadrant = angle.dividedBy(right).toNumber();
  if (operation === 'sin') return new Dec([0, 1, 0, -1][quadrant]);
  if (operation === 'cos') return new Dec([1, 0, -1, 0][quadrant]);
  return quadrant % 2 === 0 ? new Dec(0) : fail();
};

const trig = (x: Decimal, operation: 'sin' | 'cos' | 'tan', mode: AngleMode): Decimal => {
  if (x.abs().gte('1e10')) fail(); // hardware calculators reject huge angles
  if (mode !== 'RAD') {
    const exact = exactAngle(x, mode, operation);
    if (exact) return exact;
  }
  const radians = toRadians(x, mode);
  const sin = snap(Dec.sin(radians), x);
  const cos = snap(Dec.cos(radians), x);
  if (operation === 'sin') return sin;
  if (operation === 'cos') return cos;
  return cos.isZero() ? fail() : sin.dividedBy(cos);
};

/** Half a turn in each unit: 180°, π rad, 200 grad. */
const halfTurn = (mode: AngleMode): Decimal => (mode === 'DEG' ? new Dec(180) : mode === 'GRA' ? new Dec(200) : PI_DEC);
const toRadians = (value: Decimal, mode: AngleMode): Decimal => (mode === 'RAD' ? value : value.times(PI_DEC).dividedBy(halfTurn(mode)));
const fromRadians = (radians: Decimal, mode: AngleMode): Decimal => (mode === 'RAD' ? radians : radians.times(halfTurn(mode)).dividedBy(PI_DEC));

/** Converts an angle from one unit to another (Casio DRG▶). */
export const convertAngle = (value: string, from: AngleMode, to: AngleMode): string =>
  store(fromRadians(toRadians(parse(value), from), to));

/** Polar angle of (x, y) in the given unit, in (−half turn, half turn]. */
export const angleOf = (x: string, y: string, mode: AngleMode): string => {
  const dx = parse(x); const dy = parse(y);
  if (dx.isZero() && dy.isZero()) fail();
  return store(fromRadians(Dec.atan2(dy, dx), mode));
};

const unary = (x: Decimal, operation: UnaryOperation, mode: AngleMode): Decimal => {
  switch (operation) {
    case 'sin': case 'cos': case 'tan': return trig(x, operation, mode);
    case 'asin': return x.abs().gt(1) ? fail() : fromRadians(Dec.asin(x), mode);
    case 'acos': return x.abs().gt(1) ? fail() : fromRadians(Dec.acos(x), mode);
    case 'atan': return fromRadians(Dec.atan(x), mode);
    case 'sinh': return Dec.sinh(x);
    case 'cosh': return Dec.cosh(x);
    case 'tanh': return Dec.tanh(x);
    case 'asinh': return Dec.asinh(x);
    case 'acosh': return x.lt(1) ? fail() : Dec.acosh(x);
    case 'atanh': return x.abs().gte(1) ? fail() : Dec.atanh(x);
    case 'log': return x.lte(0) ? fail() : Dec.log10(x);
    case 'ln': return x.lte(0) ? fail() : Dec.ln(x);
    case 'pow10': return x.gt(MAX_EXPONENT + 1) ? fail() : Dec.pow(10, x);
    case 'exp': return x.gt(23100) ? fail() : Dec.exp(x); // e^23026 already exceeds 1e9999
    case 'sqrt': return x.isNegative() ? fail() : x.sqrt();
    case 'cbrt': return x.cbrt();
    case 'square': return x.times(x);
    case 'cube': return x.times(x).times(x);
    case 'reciprocal': return x.isZero() ? fail() : new Dec(1).dividedBy(x);
    case 'factorial': return factorial(x);
    case 'abs': return x.abs();
  }
};

export const evaluateScientific = (value: string, operation: UnaryOperation, angleMode: AngleMode = 'RAD'): string =>
  store(unary(parse(value), operation, angleMode));

export const negate = (value: string): string => store(parse(value).negated());

export const compare = (a: string, b: string): number => parse(a).comparedTo(parse(b));
export const isInteger = (value: string): boolean => parse(value).isInteger();
export const toNumber = (value: string): number => parse(value).toNumber();
export const fromNumber = (value: number): string => (Number.isFinite(value) ? store(new Dec(value)) : fail());

/** Rounds to a number of significant digits (used for results of numerical methods). */
export const roundSignificant = (value: string, digits: number): string =>
  store(parse(value).toSignificantDigits(digits));

/** Rounds to a number of decimal places. */
export const roundDecimals = (value: string, places: number): string =>
  store(parse(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP));

export type NumberFormat = { kind: 'norm'; mode: 1 | 2 } | { kind: 'fix'; places: number } | { kind: 'sci'; digits: number };
export interface Rendered { mantissa: string; exponent: number | null }

const trimZeros = (text: string) => (text.includes('.') ? text.replace(/\.?0+$/, '') : text);

const scientific = (value: Decimal, digits: number, pad: boolean): Rendered => {
  const [mantissa, exponent] = value.toExponential(digits - 1, Decimal.ROUND_HALF_UP).split('e');
  return { mantissa: pad ? mantissa : trimZeros(mantissa), exponent: Number(exponent) };
};

/**
 * Casio-style result display. Norm 1 switches to exponents below 0.01, Norm 2 below 1e-9;
 * both above 1e30 (display width). Fix sets decimal places, Sci sets significant digits.
 */
export const renderNumber = (value: string, format: NumberFormat): Rendered => {
  const x = parse(value);
  const abs = x.abs();
  const big = abs.gte(new Dec(10).pow(DISPLAY_DIGITS));
  if (format.kind === 'sci') return scientific(x, format.digits || DISPLAY_DIGITS, true);
  if (format.kind === 'fix') {
    if (big) return scientific(x, DISPLAY_DIGITS, false);
    const fixed = x.toFixed(format.places, Decimal.ROUND_HALF_UP);
    return { mantissa: /^-0(\.0*)?$/.test(fixed) ? fixed.slice(1) : fixed, exponent: null };
  }
  const small = !x.isZero() && abs.lt(format.mode === 1 ? '0.01' : '1e-9');
  if (big || small) return scientific(x, DISPLAY_DIGITS, false);
  const rounded = x.toSignificantDigits(DISPLAY_DIGITS, Decimal.ROUND_HALF_UP);
  return { mantissa: trimZeros(rounded.toFixed()), exponent: null };
};

/** Engineering display: exponent is a multiple of 3, shifted by `shift` steps of 10^3. */
export const renderEngineering = (value: string, shift: number): Rendered => {
  const x = parse(value);
  const base = x.isZero() ? 0 : Math.floor(x.abs().log(10).floor().toNumber() / 3) * 3;
  const exponent = base + shift * 3;
  const mantissa = x.dividedBy(new Dec(10).pow(exponent)).toSignificantDigits(DISPLAY_DIGITS);
  return { mantissa: trimZeros(mantissa.toFixed()), exponent };
};

/** Fraction form if it fits in 10 characters (Casio limit); null otherwise. */
export const renderFraction = (value: string, mixed: boolean): string | null => {
  const x = parse(value);
  if (x.isInteger()) return null;
  const [n, d] = x.toFraction(new Dec('1e10'));
  if (!n.dividedBy(d).minus(x).abs().lte(x.abs().times('1e-28'))) return null;
  const sign = n.isNegative() ? '-' : '';
  const num = n.abs();
  const text = mixed && num.gt(d)
    ? `${sign}${num.dividedToIntegerBy(d).toFixed()}⌟${num.mod(d).toFixed()}⌟${d.toFixed()}`
    : `${sign}${num.toFixed()}⌟${d.toFixed()}`;
  return text.replace('-', '').length <= 10 ? text : null;
};

/** Degrees-minutes-seconds form, seconds to two decimals: 2°15'18". */
export const renderDms = (value: string): string => {
  const x = parse(value);
  if (x.abs().gte('1e7')) fail();
  const totalSeconds = x.abs().times(3600).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const degrees = totalSeconds.dividedToIntegerBy(3600);
  const minutes = totalSeconds.minus(degrees.times(3600)).dividedToIntegerBy(60);
  const seconds = totalSeconds.minus(degrees.times(3600)).minus(minutes.times(60));
  return `${x.isNegative() ? '-' : ''}${degrees.toFixed()}°${minutes.toFixed()}'${trimZeros(seconds.toFixed(2))}"`;
};

/** Prime factorization like the fx-991ES: primes below 1000, any larger remainder in parentheses. */
export const primeFactors = (value: string): string => {
  const x = parse(value);
  if (!x.isInteger() || x.lt(2) || x.gte('1e10')) fail();
  let n = BigInt(x.toFixed());
  const parts: string[] = [];
  for (let p = 2n; p < 1000n && p * p <= n; p += p === 2n ? 1n : 2n) {
    let count = 0;
    while (n % p === 0n) { n /= p; count++; }
    if (count) parts.push(count > 1 ? `${p}${superscript(count)}` : `${p}`);
  }
  if (n > 1n) parts.push(n < 1000n ? `${n}` : `(${n})`);
  return parts.join('×');
};

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const superscript = (n: number): string =>
  String(n).replace('-', '⁻').replace(/[0-9]/g, d => SUPERSCRIPT[Number(d)]);
