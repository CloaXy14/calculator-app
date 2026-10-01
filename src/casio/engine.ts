import {
  DISPLAY_DIGITS, compare, evaluate, primeFactors, renderDms, renderEngineering, renderFraction, renderNumber,
  roundDecimals, roundSignificant,
} from '../utils/math';
import type { AngleMode, NumberFormat, Rendered } from '../utils/math';
import { evaluateCalc, evaluateStatement, solve } from './evaluate';
import type { EvalContext, Outcome } from './evaluate';
import { CalcError, parse, variablesIn } from './parser';
import type { Statement } from './parser';
import { CONTINUES_ANSWER, VARIABLES, layout } from './tokens';
import type { Variable } from './tokens';

/** Physical keys of the fx-991ES-style keypad. */
export type Key =
  | 'shift' | 'alpha' | 'left' | 'right' | 'up' | 'down' | 'mode' | 'on'
  | 'calc' | 'integral' | 'inv' | 'logab'
  | 'frac' | 'sqrt' | 'square' | 'power' | 'log' | 'ln'
  | 'neg' | 'dms' | 'hyp' | 'sin' | 'cos' | 'tan'
  | 'rcl' | 'eng' | 'open' | 'close' | 'sd' | 'mplus'
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'dot' | 'exp' | 'ans' | 'equals' | 'del' | 'ac' | 'times' | 'divide' | 'plus' | 'minus';

type Command =
  | 'equals' | 'del' | 'ins' | 'ac' | 'off' | 'left' | 'right' | 'up' | 'down'
  | 'mode' | 'setup' | 'clr' | 'hyp' | 'drg' | 'calc' | 'solve' | 'rcl' | 'sto'
  | 'eng' | 'engLeft' | 'sd' | 'mixed' | 'dms' | 'fact' | 'mplus' | 'mminus';
type Action = { insert: string } | { command: Command };
interface KeyFunctions { main?: Action; shift?: Action; alpha?: Action }

const ins = (insert: string): Action => ({ insert });
const cmd = (command: Command): Action => ({ command });

/** What each key does, unshifted, after SHIFT, and after ALPHA (fx-991ES PLUS layout). */
export const KEYMAP: Record<Key, KeyFunctions> = {
  shift: {}, alpha: {}, on: {},
  left: { main: cmd('left') }, right: { main: cmd('right') }, up: { main: cmd('up') }, down: { main: cmd('down') },
  mode: { main: cmd('mode'), shift: cmd('setup') },
  calc: { main: cmd('calc'), shift: cmd('solve'), alpha: ins('=') },
  integral: { main: ins('integral('), shift: ins('diff('), alpha: ins(':') },
  inv: { main: ins('inv'), shift: ins('fact') },
  logab: { main: ins('log('), shift: ins('sum(') },
  frac: { main: ins('frac'), shift: ins('frac') },
  sqrt: { main: ins('sqrt('), shift: ins('cbrt(') },
  square: { main: ins('sq'), shift: ins('cube') },
  power: { main: ins('^('), shift: ins('xroot(') },
  log: { main: ins('log('), shift: ins('pow10(') },
  ln: { main: ins('ln('), shift: ins('exp(') },
  neg: { main: ins('neg'), alpha: ins('A') },
  dms: { main: cmd('dms'), shift: cmd('fact'), alpha: ins('B') },
  hyp: { main: cmd('hyp'), shift: ins('abs('), alpha: ins('C') },
  sin: { main: ins('sin('), shift: ins('asin('), alpha: ins('D') },
  cos: { main: ins('cos('), shift: ins('acos('), alpha: ins('E') },
  tan: { main: ins('tan('), shift: ins('atan('), alpha: ins('F') },
  rcl: { main: cmd('rcl'), shift: cmd('sto') },
  eng: { main: cmd('eng'), shift: cmd('engLeft') },
  open: { main: ins('('), shift: ins('pct'), alpha: ins('X') },
  close: { main: ins(')'), shift: ins(','), alpha: ins('Y') },
  sd: { main: cmd('sd'), shift: cmd('mixed') },
  mplus: { main: cmd('mplus'), shift: cmd('mminus'), alpha: ins('M') },
  0: { main: ins('0'), shift: ins('rnd(') },
  1: { main: ins('1') }, 2: { main: ins('2') }, 3: { main: ins('3') },
  4: { main: ins('4') }, 5: { main: ins('5') }, 6: { main: ins('6') },
  7: { main: ins('7') }, 8: { main: ins('8') }, 9: { main: ins('9'), shift: cmd('clr') },
  dot: { main: ins('.'), shift: ins('Ran#'), alpha: ins('ranint(') },
  exp: { main: ins('E'), shift: ins('pi'), alpha: ins('e') },
  ans: { main: ins('Ans'), shift: cmd('drg') },
  equals: { main: cmd('equals') },
  del: { main: cmd('del'), shift: cmd('ins') },
  ac: { main: cmd('ac'), shift: cmd('off') },
  times: { main: ins('*'), shift: ins('nPr') },
  divide: { main: ins('/'), shift: ins('nCr') },
  plus: { main: ins('+'), shift: ins('pol(') },
  minus: { main: ins('-'), shift: ins('rec(') },
};

/** Keys that name a variable after STO or RCL (the ALPHA labels). */
const VARIABLE_KEYS: Partial<Record<Key, Variable>> = {
  neg: 'A', dms: 'B', hyp: 'C', sin: 'D', cos: 'E', tan: 'F', open: 'X', close: 'Y', mplus: 'M',
};

type Menu = 'mode' | 'setup1' | 'setup2' | 'fix' | 'sci' | 'norm' | 'clr' | 'clrConfirm' | 'hyp' | 'drg';
type ClearTarget = 'setup' | 'memory' | 'all';

interface ResultInfo {
  kind: 'calc' | 'solve' | 'recall' | 'stored' | 'normal';
  value: string;
  /** Expression line shown above the result. */
  label: string;
  /** Expression to replay with ◀ ▶ and to repeat with =. */
  tokens: string[];
  format: 'dec' | 'frac' | 'dms' | 'eng' | 'fact';
  eng: number;
  mixed: boolean;
  pair?: Outcome['pair'];
  solution?: { leftMinusRight: string };
}

interface Snapshot { screen: CasioState['screen']; tokens: string[]; cursor: number; result: ResultInfo | null }

export interface CasioState {
  on: boolean;
  screen: 'edit' | 'result' | 'error' | 'menu' | 'prompt' | 'message';
  tokens: string[];
  cursor: number;
  overwrite: boolean;
  modifier: 'shift' | 'alpha' | 'sto' | 'rcl' | null;
  result: ResultInfo | null;
  error: { kind: CalcError['kind']; tokens: string[]; pos: number } | null;
  menu: { name: Menu; back: Snapshot; target?: ClearTarget } | null;
  message: string[] | null;
  prompt: { mode: 'calc' | 'solve'; source: string[]; queue: Variable[]; index: number; input: string[] } | null;
  /** Remaining statements of a multi-statement (A:B) calculation. */
  statements: { tokens: string[]; list: Statement[]; index: number } | null;
  vars: Record<Variable, string>;
  ans: string;
  history: ResultInfo[];
  historyIndex: number | null;
  angle: AngleMode;
  format: NumberFormat;
  mixedFractions: boolean;
}

const MAX_TOKENS = 99;
const MAX_HISTORY = 30;
const ZERO_VARS = Object.fromEntries(VARIABLES.map(v => [v, '0'])) as Record<Variable, string>;
const DEFAULT_FORMAT: NumberFormat = { kind: 'norm', mode: 1 };

export const initialCasio: CasioState = {
  on: true, screen: 'edit', tokens: [], cursor: 0, overwrite: false, modifier: null,
  result: null, error: null, menu: null, message: null, prompt: null, statements: null,
  vars: ZERO_VARS, ans: '0', history: [], historyIndex: null,
  angle: 'DEG', format: DEFAULT_FORMAT, mixedFractions: false,
};

/** Small deterministic generator seeded per key press, so the reducer stays pure. */
const generator = (seed: number) => {
  let a = Math.floor(seed * 2 ** 32) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const roundForDisplay = (format: NumberFormat) => (value: string): string => {
  if (format.kind === 'fix') return roundDecimals(value, format.places);
  if (format.kind === 'sci') return roundSignificant(value, format.digits || DISPLAY_DIGITS);
  return roundSignificant(value, DISPLAY_DIGITS);
};

const context = (state: CasioState, seed: number): EvalContext => ({
  angle: state.angle, vars: state.vars, ans: state.ans, random: generator(seed), roundForDisplay: roundForDisplay(state.format),
});

const text = (tokens: string[]) => layout(tokens).text;

const editing = (state: CasioState, tokens: string[], cursor = tokens.length): CasioState => ({
  ...state, screen: 'edit', tokens, cursor, result: null, error: null, prompt: null, statements: null, historyIndex: null, message: null,
});

const fail = (state: CasioState, error: unknown, tokens: string[]): CasioState => {
  const kind = error instanceof CalcError ? error.kind : 'Math';
  const pos = error instanceof CalcError ? Math.min(error.pos, tokens.length) : tokens.length;
  return { ...state, screen: 'error', error: { kind, tokens, pos }, prompt: null, statements: null };
};

const defaultFormat = (tokens: string[], value: string, mixed: boolean): ResultInfo['format'] => {
  if (tokens.includes('dms')) return 'dms';
  if (tokens.includes('frac') && !tokens.includes('.') && renderFraction(value, mixed)) return 'frac';
  return 'dec';
};

const showOutcome = (state: CasioState, tokens: string[], outcome: Outcome, extra: Partial<ResultInfo> = {}): CasioState => {
  const result: ResultInfo = {
    kind: 'normal', value: outcome.value, label: text(tokens), tokens,
    format: defaultFormat(tokens, outcome.value, state.mixedFractions), eng: 0, mixed: state.mixedFractions,
    pair: outcome.pair, ...extra,
  };
  return {
    ...state, screen: 'result', result, error: null, prompt: null, historyIndex: null,
    vars: { ...state.vars, ...outcome.vars }, ans: outcome.value,
  };
};

const remember = (state: CasioState): CasioState =>
  state.result ? { ...state, history: [...state.history, state.result].slice(-MAX_HISTORY) } : state;

const runStatement = (state: CasioState, tokens: string[], list: Statement[], index: number, seed: number): CasioState => {
  try {
    const outcome = evaluateStatement(list[index], context(state, seed));
    const shown = showOutcome(state, tokens, outcome);
    const more = index + 1 < list.length;
    return remember({ ...shown, statements: more ? { tokens, list, index: index + 1 } : null });
  } catch (error) {
    return fail(state, error, tokens);
  }
};

const execute = (state: CasioState, tokens: string[], seed: number): CasioState => {
  if (!tokens.length) return state;
  let list: Statement[];
  try {
    list = parse(tokens);
  } catch (error) {
    return fail(state, error, tokens);
  }
  return runStatement(state, tokens, list, 0, seed);
};

/** Tokens of the expression the user is working with: the input line or the last calculation. */
const sourceTokens = (state: CasioState): string[] =>
  state.screen === 'edit' ? state.tokens : state.result?.tokens ?? state.history.at(-1)?.tokens ?? [];

const insertToken = (state: CasioState, token: string): CasioState => {
  if (state.screen === 'prompt' && state.prompt) {
    const input = [...state.prompt.input, token].slice(0, MAX_TOKENS);
    return { ...state, prompt: { ...state.prompt, input } };
  }
  if (state.screen !== 'edit') {
    const continues = state.screen === 'result' && state.result?.kind !== 'recall' && CONTINUES_ANSWER.has(token);
    return editing(state, continues ? ['Ans', token] : [token]);
  }
  if (state.tokens.length >= MAX_TOKENS && !(state.overwrite && state.cursor < state.tokens.length)) return state;
  const tokens = [...state.tokens];
  tokens.splice(state.cursor, state.overwrite && state.cursor < tokens.length ? 1 : 0, token);
  return { ...state, tokens, cursor: state.cursor + 1 };
};

const deleteToken = (state: CasioState): CasioState => {
  if (state.screen === 'prompt' && state.prompt) return { ...state, prompt: { ...state.prompt, input: state.prompt.input.slice(0, -1) } };
  const base = state.screen === 'edit' ? state : editing(state, sourceTokens(state));
  const at = base.overwrite && base.cursor < base.tokens.length ? base.cursor : base.cursor - 1;
  if (at < 0) return base;
  const tokens = base.tokens.filter((_, index) => index !== at);
  return { ...base, tokens, cursor: at };
};

const openMenu = (state: CasioState, name: Menu, target?: ClearTarget): CasioState => ({
  ...state,
  screen: 'menu',
  menu: {
    name,
    target,
    back: state.menu?.back ?? { screen: state.screen === 'menu' ? 'edit' : state.screen, tokens: state.tokens, cursor: state.cursor, result: state.result },
  },
});

const closeMenu = (state: CasioState, patch: Partial<CasioState> = {}): CasioState => {
  const back = state.menu?.back;
  const next = { ...state, ...patch, menu: null };
  if (!back) return editing(next, []);
  const screen = back.screen === 'result' && back.result ? 'result' : 'edit';
  return { ...next, screen, tokens: back.tokens, cursor: back.cursor, result: screen === 'result' ? back.result : null };
};

const HYPERBOLIC = ['sinh(', 'cosh(', 'tanh(', 'asinh(', 'acosh(', 'atanh('];
const ANGLE_POSTFIX = ['drgD', 'drgR', 'drgG'];

const menuKey = (state: CasioState, key: Key): CasioState => {
  const menu = state.menu!;
  if (key === 'ac') return menu.name === 'clrConfirm' || menu.name === 'clr' ? closeMenu(state) : closeMenu(state);
  const digit = /^[0-9]$/.test(key) ? Number(key) : null;
  switch (menu.name) {
    case 'mode':
      return digit === 1 ? { ...editing({ ...state, menu: null }, []), history: [] } : state;
    case 'setup1':
      if (key === 'down') return openMenu(state, 'setup2');
      if (digit === 2) return closeMenu(state);
      if (digit !== null && digit >= 3 && digit <= 5) return closeMenu(state, { angle: (['DEG', 'RAD', 'GRA'] as const)[digit - 3] });
      if (digit === 6) return openMenu(state, 'fix');
      if (digit === 7) return openMenu(state, 'sci');
      if (digit === 8) return openMenu(state, 'norm');
      return state;
    case 'setup2':
      if (key === 'up') return openMenu(state, 'setup1');
      return digit === 1 || digit === 2 ? closeMenu(state, { mixedFractions: digit === 1 }) : state;
    case 'fix':
      return digit === null ? state : closeMenu(state, { format: { kind: 'fix', places: digit } });
    case 'sci':
      return digit === null ? state : closeMenu(state, { format: { kind: 'sci', digits: digit } });
    case 'norm':
      return digit === 1 || digit === 2 ? closeMenu(state, { format: { kind: 'norm', mode: digit } }) : state;
    case 'clr':
      return digit !== null && digit >= 1 && digit <= 3 ? openMenu(state, 'clrConfirm', (['setup', 'memory', 'all'] as const)[digit - 1]) : state;
    case 'clrConfirm': {
      if (key !== 'equals') return state;
      const target = menu.target!;
      const setup = target !== 'memory' ? { angle: initialCasio.angle, format: DEFAULT_FORMAT, mixedFractions: false } : {};
      const memory = target !== 'setup' ? { vars: ZERO_VARS, ans: '0' } : {};
      const message = { setup: 'Reset Setup', memory: 'Clear Memory', all: 'Reset All' }[target];
      return { ...editing({ ...state, ...setup, ...memory, menu: null }, []), screen: 'message', message: [message, 'Press [AC] Key'], history: target === 'memory' ? state.history : [] };
    }
    case 'hyp':
    case 'drg': {
      const options = menu.name === 'hyp' ? HYPERBOLIC : ANGLE_POSTFIX;
      if (digit === null || digit < 1 || digit > options.length) return state;
      return insertToken(closeMenu(state), options[digit - 1]);
    }
  }
};

const startPrompt = (state: CasioState, mode: 'calc' | 'solve', seed: number): CasioState => {
  const source = sourceTokens(state);
  if (!source.length) return state;
  let list: Statement[];
  try {
    list = parse(source);
  } catch (error) {
    return fail(state, error, source);
  }
  const equalsAt = source.indexOf('=');
  const assigned = mode === 'calc' && equalsAt > 0 && list[0].left.t === 'var' ? list[0].left.name : null;
  const used = variablesIn(mode === 'calc' && assigned ? source.slice(equalsAt + 1) : source);
  if (mode === 'solve' && !used.includes('X')) return fail(state, new CalcError('Syntax', 0), source);
  const queue = mode === 'solve' ? [...used.filter(v => v !== 'X'), 'X' as Variable] : used;
  if (!queue.length) return finishPrompt({ ...state, prompt: { mode, source, queue, index: 0, input: [] } }, seed);
  return { ...state, screen: 'prompt', result: null, prompt: { mode, source, queue, index: 0, input: [] } };
};

const finishPrompt = (state: CasioState, seed: number): CasioState => {
  const prompt = state.prompt!;
  const ctx = context(state, seed);
  const [statement] = parse(prompt.source);
  try {
    if (prompt.mode === 'calc') {
      return showOutcome(state, prompt.source, evaluateCalc(statement, ctx), { kind: 'calc' });
    }
    const { x, leftMinusRight } = solve(statement, ctx);
    const shown = showOutcome(state, prompt.source, { value: x, vars: { X: x } }, { kind: 'solve', format: 'dec', solution: { leftMinusRight } });
    return { ...shown, ans: state.ans };
  } catch (error) {
    return fail(state, error, prompt.source);
  }
};

const promptEnter = (state: CasioState, seed: number): CasioState => {
  const prompt = state.prompt!;
  let vars = state.vars;
  if (prompt.input.length) {
    try {
      const [statement] = parse(prompt.input);
      vars = { ...vars, [prompt.queue[prompt.index]]: evaluateStatement(statement, context(state, seed)).value };
    } catch (error) {
      return fail(state, error, prompt.input);
    }
  }
  const next = { ...state, vars, prompt: { ...prompt, index: prompt.index + 1, input: [] } };
  return next.prompt.index < prompt.queue.length ? next : finishPrompt(next, seed);
};

const memoryAdd = (state: CasioState, sign: '+' | '-', seed: number): CasioState => {
  const evaluated = state.screen === 'edit' ? execute(state, state.tokens, seed) : state;
  if (evaluated.screen === 'error' || !evaluated.result) return evaluated;
  const value = evaluated.result.value;
  try {
    const memory = evaluate(state.vars.M, value, sign);
    const label = `${state.screen === 'edit' ? text(state.tokens) : 'Ans'}${sign === '+' ? 'M+' : 'M−'}`;
    return { ...evaluated, vars: { ...evaluated.vars, M: memory }, ans: value, result: { ...evaluated.result, label } };
  } catch (error) {
    return fail(state, error, state.tokens);
  }
};

const storeVariable = (state: CasioState, variable: Variable, seed: number): CasioState => {
  const evaluated = state.screen === 'edit' && state.tokens.length ? execute(state, state.tokens, seed) : state;
  if (evaluated.screen === 'error') return evaluated;
  const value = evaluated.result?.value ?? state.ans;
  const label = `${state.screen === 'edit' && state.tokens.length ? text(state.tokens) : 'Ans'}→${variable}`;
  const tokens = evaluated.result?.tokens ?? ['Ans'];
  return showOutcome(evaluated, tokens, { value, vars: { [variable]: value } }, { kind: 'stored', label });
};

const recallVariable = (state: CasioState, variable: Variable): CasioState => ({
  ...state, screen: 'result', historyIndex: null, error: null,
  result: { kind: 'recall', value: state.vars[variable], label: `${variable}=`, tokens: [variable], format: 'dec', eng: 0, mixed: state.mixedFractions },
});

const resultCommand = (state: CasioState, command: Command): CasioState => {
  const result = state.result!;
  const update = (patch: Partial<ResultInfo>) => ({ ...state, result: { ...result, ...patch } });
  switch (command) {
    case 'sd': {
      if (result.format === 'frac') return update({ format: 'dec' });
      return renderFraction(result.value, result.mixed) ? update({ format: 'frac' }) : state;
    }
    case 'mixed': return result.format === 'frac' ? update({ mixed: !result.mixed }) : state;
    case 'dms': return update({ format: result.format === 'dms' ? 'dec' : 'dms' });
    case 'eng': return update({ format: 'eng', eng: result.format === 'eng' ? result.eng - 1 : 0 });
    case 'engLeft': return update({ format: 'eng', eng: result.format === 'eng' ? result.eng + 1 : 1 });
    case 'fact':
      try {
        primeFactors(result.value);
        return update({ format: 'fact' });
      } catch (error) {
        return fail(state, error, result.tokens);
      }
    default: return state;
  }
};

const browseHistory = (state: CasioState, step: -1 | 1): CasioState => {
  const last = state.history.length - 1;
  const current = state.historyIndex ?? last;
  const index = Math.max(0, Math.min(last, current + step));
  if (last < 0 || index === current) return state;
  return { ...state, screen: 'result', result: state.history[index], historyIndex: index };
};

const command = (state: CasioState, name: Command, seed: number): CasioState => {
  const onResult = state.screen === 'result' && state.result;
  switch (name) {
    case 'off': return { ...state, on: false };
    case 'ac': return editing(state, []);
    case 'ins': return { ...state, overwrite: !state.overwrite };
    case 'del': return deleteToken(state);
    case 'mode': return openMenu(state, 'mode');
    case 'setup': return openMenu(state, 'setup1');
    case 'clr': return openMenu(state, 'clr');
    case 'hyp': return openMenu(state, 'hyp');
    case 'drg': return openMenu(state, 'drg');
    case 'rcl': return { ...state, modifier: 'rcl' };
    case 'sto': return { ...state, modifier: 'sto' };
    case 'calc': return startPrompt(state, 'calc', seed);
    case 'solve': return startPrompt(state, 'solve', seed);
    case 'mplus': return memoryAdd(state, '+', seed);
    case 'mminus': return memoryAdd(state, '-', seed);
    case 'left':
    case 'right':
      if (state.screen === 'edit') {
        const cursor = state.cursor + (name === 'left' ? -1 : 1);
        return { ...state, cursor: Math.max(0, Math.min(state.tokens.length, cursor)) };
      }
      if (state.screen === 'result') {
        const tokens = state.result?.kind === 'recall' ? [] : sourceTokens(state);
        return editing(state, tokens, name === 'left' ? tokens.length : 0);
      }
      return state;
    case 'up':
    case 'down':
      if (state.screen === 'edit' && state.tokens.length) return { ...state, cursor: name === 'up' ? 0 : state.tokens.length };
      return browseHistory(state, name === 'up' ? -1 : 1);
    case 'equals':
      if (state.screen === 'prompt') return promptEnter(state, seed);
      if (state.statements) return runStatement(state, state.statements.tokens, state.statements.list, state.statements.index, seed);
      if (onResult && (state.result!.kind === 'calc' || state.result!.kind === 'solve')) {
        return startPrompt(state, state.result!.kind === 'calc' ? 'calc' : 'solve', seed);
      }
      return execute(state, sourceTokens(state), seed);
    case 'dms':
      return onResult ? resultCommand(state, 'dms') : insertToken(state, 'dms');
    case 'sd':
      if (state.screen === 'edit') {
        const done = execute(state, state.tokens, seed);
        return done.screen === 'result' ? resultCommand(done, 'sd') : done;
      }
      return onResult ? resultCommand(state, 'sd') : state;
    case 'mixed': case 'eng': case 'engLeft': case 'fact':
      return onResult ? resultCommand(state, name) : state;
  }
};

/** Applies one key press. `seed` drives Ran# and RanInt# for this press. */
export const press = (state: CasioState, key: Key, seed = Math.random()): CasioState => {
  if (!state.on) return key === 'on' ? { ...initialCasio, vars: state.vars, ans: state.ans, angle: state.angle, format: state.format, mixedFractions: state.mixedFractions } : state;
  if (key === 'on') return { ...editing(state, []), modifier: null, menu: null, history: [] };
  if (key === 'shift' || key === 'alpha') return { ...state, modifier: state.modifier === key ? null : key };
  const modifier = state.modifier;
  const current = { ...state, modifier: null };
  if (current.screen === 'menu') return menuKey(current, key);
  if (current.screen === 'message') return key === 'ac' ? editing(current, []) : current;
  if (current.screen === 'error') {
    if (key === 'ac') return editing(current, []);
    if (key === 'left' || key === 'right') return editing(current, current.error!.tokens, current.error!.pos);
    return current;
  }
  if (modifier === 'sto' || modifier === 'rcl') {
    const variable = VARIABLE_KEYS[key];
    if (!variable) return current;
    return modifier === 'sto' ? storeVariable(current, variable, seed) : recallVariable(current, variable);
  }
  const functions = KEYMAP[key];
  const action = modifier === 'shift' ? functions.shift : modifier === 'alpha' ? functions.alpha : functions.main;
  if (!action) return current;
  return 'insert' in action ? insertToken(current, action.insert) : command(current, action.command, seed);
};

// ---------------------------------------------------------------- display

export interface View {
  off: boolean;
  indicators: string[];
  /** First line: input expression, menu title, or the calculation of the shown result. */
  top: string;
  /** Character offset of the cursor in `top` while editing; null otherwise. */
  cursor: number | null;
  overwrite: boolean;
  /** Second line, right-aligned: result mantissa, fraction, DMS, or prompt value. */
  bottom: string;
  bottomLabel: string;
  exponent: number | null;
  /** Extra lines for menus, error help, and the SOLVE residual. */
  extra: string[];
}

const ERROR_TITLES: Record<CalcError['kind'], string> = {
  Syntax: 'Syntax ERROR', Math: 'Math ERROR', Argument: 'Argument ERROR', "Can't Solve": "Can't Solve",
};

const MENUS: Record<Menu, string[]> = {
  mode: ['1:COMP'],
  setup1: ['2:LineIO 3:Deg', '4:Rad  5:Gra', '6:Fix 7:Sci 8:Norm'],
  setup2: ['1:ab/c   2:d/c'],
  fix: ['Fix 0~9?'],
  sci: ['Sci 0~9?'],
  norm: ['Norm 1~2?'],
  clr: ['Clear?', '1:Setup 2:Memory', '3:All'],
  clrConfirm: [],
  hyp: ['1:sinh  2:cosh', '3:tanh  4:sinh⁻¹', '5:cosh⁻¹ 6:tanh⁻¹'],
  drg: ['1:°   2:ʳ   3:ᵍ'],
};

const plain = (value: string, format: NumberFormat): string => {
  const rendered = renderNumber(value, format);
  return rendered.exponent === null ? rendered.mantissa : `${rendered.mantissa}×10${superscriptExponent(rendered.exponent)}`;
};

const superscriptExponent = (n: number) => String(n).replace('-', '⁻').replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);

const tiny = (value: string) => compare(value, '1e-25') < 0 && compare(value, '-1e-25') > 0;

const renderResult = (result: ResultInfo, format: NumberFormat): Rendered | string => {
  switch (result.format) {
    case 'frac': return renderFraction(result.value, result.mixed) ?? renderNumber(result.value, format);
    case 'dms': return renderDms(result.value);
    case 'eng': return renderEngineering(result.value, result.eng);
    case 'fact': return primeFactors(result.value);
    default: return renderNumber(result.value, format);
  }
};

export const view = (state: CasioState): View => {
  const blank: View = { off: false, indicators: [], top: '', cursor: null, overwrite: state.overwrite, bottom: '', bottomLabel: '', exponent: null, extra: [] };
  if (!state.on) return { ...blank, off: true };
  const indicators = [
    state.modifier === 'shift' && 'S', state.modifier === 'alpha' && 'A', state.vars.M !== '0' && 'M',
    state.modifier === 'sto' && 'STO', state.modifier === 'rcl' && 'RCL',
    { DEG: 'D', RAD: 'R', GRA: 'G' }[state.angle],
    state.format.kind === 'fix' && 'FIX', state.format.kind === 'sci' && 'SCI',
    state.statements && 'Disp',
    state.screen === 'result' && state.history.length > 0 && (state.historyIndex ?? state.history.length - 1) > 0 && '▲',
    state.screen === 'result' && state.historyIndex !== null && state.historyIndex < state.history.length - 1 && '▼',
  ].filter(Boolean) as string[];
  const base = { ...blank, indicators };

  switch (state.screen) {
    case 'edit': {
      const { text: line, offsets } = layout(state.tokens);
      return { ...base, top: line, cursor: offsets[state.cursor], bottom: '' };
    }
    case 'error':
      return { ...base, top: ERROR_TITLES[state.error!.kind], extra: ['[AC] :Cancel', '[◀][▶]:Goto'] };
    case 'message':
      return { ...base, top: state.message![0], extra: state.message!.slice(1) };
    case 'menu': {
      const menu = state.menu!;
      if (menu.name === 'clrConfirm') {
        const title = { setup: 'Reset Setup?', memory: 'Clear Memory?', all: 'Reset All?' }[menu.target!];
        return { ...base, top: title, extra: ['[=] :Yes', '[AC]:Cancel'] };
      }
      return { ...base, top: '', extra: MENUS[menu.name] };
    }
    case 'prompt': {
      const prompt = state.prompt!;
      const variable = prompt.queue[prompt.index];
      const typed = prompt.input.length ? layout(prompt.input).text : null;
      return { ...base, top: `${variable}?`, bottom: typed ?? plain(state.vars[variable], state.format) };
    }
    case 'result': {
      const result = state.result!;
      if (result.pair) {
        const [a, b] = result.pair.labels;
        const [x, y] = result.pair.values;
        return { ...base, top: `${a}=${plain(x, state.format)}`, bottom: `${b}=${plain(y, state.format)}` };
      }
      const rendered = renderResult(result, state.format);
      const bottom = typeof rendered === 'string' ? rendered : rendered.mantissa;
      const exponent = typeof rendered === 'string' ? null : rendered.exponent;
      if (result.kind === 'solve') {
        const residual = result.solution!.leftMinusRight;
        return { ...base, top: result.label, bottomLabel: 'X=', bottom, exponent, extra: [`L−R=${tiny(residual) ? '0' : plain(residual, state.format)}`] };
      }
      return { ...base, top: result.label, bottom, exponent };
    }
  }
};
