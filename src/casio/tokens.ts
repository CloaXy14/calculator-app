/**
 * Input tokens of the scientific (fx-991ES-style, LineIO) calculator.
 * Like the real calculator, one key press inserts one token (sin( is a single token),
 * and DEL removes a whole token.
 */
export const VARIABLES = ['A', 'B', 'C', 'D', 'E', 'F', 'X', 'Y', 'M'] as const;
export type Variable = typeof VARIABLES[number];

export const FUNCTIONS = {
  'sin(': 'sin(', 'cos(': 'cos(', 'tan(': 'tan(',
  'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(',
  'sinh(': 'sinh(', 'cosh(': 'cosh(', 'tanh(': 'tanh(',
  'asinh(': 'sinh⁻¹(', 'acosh(': 'cosh⁻¹(', 'atanh(': 'tanh⁻¹(',
  'log(': 'log(', 'ln(': 'ln(', 'pow10(': '10^(', 'exp(': 'e^(',
  'sqrt(': '√(', 'cbrt(': '³√(', 'abs(': 'Abs(',
  'pol(': 'Pol(', 'rec(': 'Rec(', 'rnd(': 'Rnd(', 'ranint(': 'RanInt#(',
  'integral(': '∫(', 'diff(': 'd/dx(', 'sum(': 'Σ(',
} as const;
export type FunctionToken = keyof typeof FUNCTIONS;

export const POSTFIX = { sq: '²', cube: '³', inv: '⁻¹', fact: '!', pct: '%', drgD: '°', drgR: 'ʳ', drgG: 'ᵍ' } as const;
export type PostfixToken = keyof typeof POSTFIX;

const TEXT: Record<string, string> = {
  ...FUNCTIONS,
  ...POSTFIX,
  '+': '+', '-': '−', '*': '×', '/': '÷', neg: '-',
  '(': '(', ')': ')', ',': ',', ':': ':', '=': '=',
  '^(': '^(', 'xroot(': 'ˣ√(', frac: '⌟', dms: '°', E: 'ᴇ',
  nPr: 'P', nCr: 'C', pi: 'π', e: 'e', Ans: 'Ans', 'Ran#': 'Ran#',
};

export const tokenText = (token: string): string => TEXT[token] ?? token;

export const isFunction = (token: string): token is FunctionToken => token in FUNCTIONS;
export const isPostfix = (token: string): token is PostfixToken => token in POSTFIX;
export const isVariable = (token: string): token is Variable => (VARIABLES as readonly string[]).includes(token);
export const isDigit = (token: string): boolean => /^[0-9]$/.test(token);

/** Tokens that continue a result as "Ans …" when pressed right after a calculation. */
export const CONTINUES_ANSWER = new Set<string>([
  '+', '-', '*', '/', '^(', 'xroot(', 'frac', 'nPr', 'nCr', ...Object.keys(POSTFIX),
]);

/** Text of a whole expression plus the character offset of each token boundary. */
export const layout = (tokens: string[]): { text: string; offsets: number[] } => {
  const offsets = [0];
  let text = '';
  for (const token of tokens) {
    text += tokenText(token);
    offsets.push(text.length);
  }
  return { text, offsets };
};
