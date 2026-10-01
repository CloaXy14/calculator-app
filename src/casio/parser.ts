import { isDigit, isFunction, isPostfix, isVariable } from './tokens';
import type { FunctionToken, PostfixToken, Variable } from './tokens';

export type BinaryOp = '+' | '-' | '*' | '/' | '^' | 'root' | 'nPr' | 'nCr';

export type Node =
  | { t: 'num'; value: string; pos: number }
  | { t: 'dms'; parts: string[]; pos: number }
  | { t: 'var'; name: Variable; pos: number }
  | { t: 'const'; name: 'pi' | 'e' | 'Ans' | 'Ran#'; pos: number }
  | { t: 'bin'; op: BinaryOp; left: Node; right: Node; pos: number }
  | { t: 'neg'; arg: Node; pos: number }
  | { t: 'post'; op: PostfixToken; arg: Node; pos: number }
  | { t: 'frac'; whole: Node | null; num: Node; den: Node; pos: number }
  | { t: 'fn'; name: FunctionToken; args: Node[]; pos: number };

/** One statement; `right` is set for equations such as Y=X²+1 (CALC, SOLVE). */
export interface Statement { left: Node; right: Node | null }

export class CalcError extends Error {
  kind: 'Syntax' | 'Math' | 'Argument' | "Can't Solve";
  /** Token index where the error was found; ◀ ▶ put the cursor there. */
  pos: number;
  constructor(kind: CalcError['kind'], pos: number) {
    super(`${kind} ERROR`);
    this.kind = kind;
    this.pos = pos;
  }
}

const ARITY: Partial<Record<FunctionToken, [number, number]>> = {
  'log(': [1, 2], 'pol(': [2, 2], 'rec(': [2, 2], 'ranint(': [2, 2],
  'integral(': [3, 4], 'diff(': [2, 3], 'sum(': [3, 3],
};

/** Tokens that can follow a value with an implied multiplication (2π, 3sin(30), 2(1+1)). */
const startsImpliedFactor = (token: string | undefined) =>
  token !== undefined && (token === '(' || isFunction(token) || isVariable(token) || ['pi', 'e', 'Ans', 'Ran#'].includes(token));

/**
 * Parses LineIO input with the fx-991ES priority sequence: parentheses and functions;
 * postfix functions, powers and roots (left to right); fractions; negative sign;
 * implied multiplication; nPr/nCr; × ÷; + −.
 */
export const parse = (tokens: string[]): Statement[] => {
  let i = 0;
  const peek = () => tokens[i];
  const fail = (pos = i): never => { throw new CalcError('Syntax', pos); };
  const expect = (token: string) => {
    if (peek() === token) { i++; return; }
    // A closing parenthesis may be omitted at the end of a statement.
    if (token === ')' && (peek() === undefined || peek() === ':')) return;
    fail();
  };

  const plainNumber = (): string => {
    const start = i;
    let text = '';
    while (isDigit(peek())) text += tokens[i++];
    if (peek() === '.') {
      text += tokens[i++];
      while (isDigit(peek())) text += tokens[i++];
    }
    if (text === '.') fail(start);
    if (peek() === 'E') {
      i++;
      let exponent = '';
      if (peek() === 'neg' || peek() === '-') { i++; exponent = '-'; }
      while (isDigit(peek())) exponent += tokens[i++];
      if (exponent === '' || exponent === '-') fail();
      text = `${text || '1'}e${exponent}`;
    }
    return text;
  };

  const number = (): Node => {
    const pos = i;
    const value = plainNumber();
    if (peek() !== 'dms') return { t: 'num', value, pos };
    // Sexagesimal input: degrees° minutes° seconds°
    const parts = [value];
    i++;
    while (parts.length < 3 && (isDigit(peek()) || peek() === '.')) {
      parts.push(plainNumber());
      if (peek() !== 'dms') fail();
      i++;
    }
    return { t: 'dms', parts, pos };
  };

  const primary = (): Node => {
    const token = peek();
    const pos = i;
    if (token === undefined) return fail();
    if (isDigit(token) || token === '.' || token === 'E') return number();
    if (isVariable(token)) { i++; return { t: 'var', name: token, pos }; }
    if (token === 'pi' || token === 'e' || token === 'Ans' || token === 'Ran#') { i++; return { t: 'const', name: token, pos }; }
    if (token === '(') {
      i++;
      const inner = expression();
      expect(')');
      return inner;
    }
    if (isFunction(token)) {
      i++;
      const args = [statementExpression()];
      while (peek() === ',') { i++; args.push(statementExpression()); }
      expect(')');
      const [min, max] = ARITY[token] ?? [1, 1];
      if (args.length < min || args.length > max) fail(pos);
      return { t: 'fn', name: token, args, pos };
    }
    return fail();
  };

  const power = (): Node => {
    let node = primary();
    for (;;) {
      const token = peek();
      const pos = i;
      if (token !== undefined && isPostfix(token)) { i++; node = { t: 'post', op: token, arg: node, pos }; continue; }
      if (token === '^(' || token === 'xroot(') {
        i++;
        const exponent = expression();
        expect(')');
        node = { t: 'bin', op: token === '^(' ? '^' : 'root', left: node, right: exponent, pos };
        continue;
      }
      return node;
    }
  };

  const fraction = (): Node => {
    const first = power();
    if (peek() !== 'frac') return first;
    const pos = i++;
    const second = power();
    if (peek() !== 'frac') return { t: 'frac', whole: null, num: first, den: second, pos };
    i++;
    return { t: 'frac', whole: first, num: second, den: power(), pos };
  };

  const negative = (): Node => {
    if (peek() !== 'neg') return fraction();
    const pos = i++;
    return { t: 'neg', arg: negative(), pos };
  };

  const implied = (): Node => {
    let node = negative();
    while (startsImpliedFactor(peek())) {
      const pos = i;
      node = { t: 'bin', op: '*', left: node, right: negative(), pos };
    }
    return node;
  };

  const binary = (next: () => Node, ops: string[]) => (): Node => {
    let node = next();
    while (ops.includes(peek())) {
      const pos = i;
      const op = tokens[i++] as BinaryOp;
      node = { t: 'bin', op, left: node, right: next(), pos };
    }
    return node;
  };

  const combination = binary(implied, ['nPr', 'nCr']);
  const product = binary(combination, ['*', '/']);
  const expression = binary(product, ['+', '-']);
  const statementExpression = () => expression();

  const statements: Statement[] = [];
  do {
    if (peek() === ':') i++;
    const left = expression();
    let right: Node | null = null;
    if (peek() === '=') { i++; right = expression(); }
    statements.push({ left, right });
  } while (peek() === ':');
  if (i < tokens.length) fail();
  return statements;
};

/** Variables in order of first appearance (CALC and SOLVE prompt in this order). */
export const variablesIn = (tokens: string[]): Variable[] =>
  tokens.filter(isVariable).filter((v, index, all) => all.indexOf(v) === index);
