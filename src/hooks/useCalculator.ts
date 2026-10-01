import { useReducer, useEffect, useRef, useState } from 'react';
import { INPUT_DIGITS, evaluate, formatDisplay, negate } from '../utils/math';
import type { BinaryOperator } from '../utils/math';

/** Standard (basic) calculator: immediate execution, like a desk calculator. */
export interface CalculatorState {
  /** Text on the display: the entry being typed or a result rounded to 30 digits. */
  currentValue: string;
  /** Full-precision result behind currentValue (guard digits); null while typing. */
  exactValue: string | null;
  /** Pending left operand and operator, e.g. 12 +. */
  pending: { value: string; operator: BinaryOperator } | null;
  /** Standard or scientific (Casio-style) keypad. Each mode keeps its own calculation. */
  isScientificMode: boolean;
  overwriteNext: boolean;
  awaitingOperand: boolean;
  error: string | null;
}

export type CalculatorAction =
  | { type: 'ADD_DIGIT'; payload: string }
  | { type: 'ADD_DECIMAL' }
  | { type: 'CHOOSE_OPERATOR'; payload: string }
  | { type: 'EVALUATE' }
  | { type: 'CLEAR' }
  | { type: 'ALL_CLEAR' }
  | { type: 'DELETE' }
  | { type: 'TOGGLE_SIGN' }
  | { type: 'TOGGLE_MODE' };

const OPERATORS: readonly string[] = ['+', '-', '*', '/', '^'];
const SYMBOLS: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };

export const formatPending = (pending: CalculatorState['pending']): string =>
  pending ? `${formatDisplay(pending.value)} ${SYMBOLS[pending.operator]}` : '';

const initialState: CalculatorState = {
  currentValue: '0',
  exactValue: null,
  pending: null,
  isScientificMode: false,
  overwriteNext: false,
  awaitingOperand: false,
  error: null,
};

const operand = (state: CalculatorState): string => state.exactValue ?? state.currentValue;

const showResult = (state: CalculatorState, value: string): CalculatorState => ({
  ...state, currentValue: formatDisplay(value), exactValue: value, overwriteNext: true, awaitingOperand: false,
});

const errorState = (state: CalculatorState): CalculatorState => ({
  ...state, currentValue: 'Error', exactValue: null, pending: null, awaitingOperand: false, error: 'Error',
});

const digitCount = (value: string) => value.replace(/[^0-9]/g, '').length;

const calculate = (state: CalculatorState, action: CalculatorAction): CalculatorState => {
  switch (action.type) {
    case 'ADD_DIGIT': {
      if (!/^[0-9]$/.test(action.payload)) return state;
      const next = { ...state, exactValue: null, overwriteNext: false, awaitingOperand: false };
      if (state.overwriteNext || state.awaitingOperand || state.currentValue === '0') return { ...next, currentValue: action.payload };
      if (state.currentValue === '-0') return { ...next, currentValue: `-${action.payload}` };
      if (digitCount(state.currentValue) >= INPUT_DIGITS) return state;
      return { ...next, currentValue: `${state.currentValue}${action.payload}` };
    }

    case 'ADD_DECIMAL':
      if (state.overwriteNext || state.awaitingOperand) return { ...state, currentValue: '0.', exactValue: null, overwriteNext: false, awaitingOperand: false };
      if (state.currentValue.includes('.')) return state;
      return { ...state, currentValue: `${state.currentValue}.` };

    case 'CHOOSE_OPERATOR': {
      if (!OPERATORS.includes(action.payload)) return state;
      const operator = action.payload as BinaryOperator;
      if (state.awaitingOperand && state.pending) return { ...state, pending: { ...state.pending, operator } };
      if (!state.pending) return { ...state, pending: { value: operand(state), operator }, overwriteNext: true, awaitingOperand: true };
      const result = evaluate(state.pending.value, operand(state), state.pending.operator);
      return { ...showResult(state, result), pending: { value: result, operator }, awaitingOperand: true };
    }

    case 'EVALUATE': {
      if (!state.pending) return state;
      const result = evaluate(state.pending.value, operand(state), state.pending.operator);
      return { ...showResult(state, result), pending: null };
    }

    case 'TOGGLE_SIGN':
      if (state.awaitingOperand) return { ...state, currentValue: '-0', exactValue: null, overwriteNext: false, awaitingOperand: false };
      return {
        ...state,
        currentValue: state.currentValue.startsWith('-') ? state.currentValue.slice(1) : `-${state.currentValue}`,
        exactValue: state.exactValue && negate(state.exactValue),
      };

    case 'DELETE': {
      const shortened = state.overwriteNext ? '0' : state.currentValue.slice(0, -1);
      return { ...state, currentValue: shortened === '' || shortened === '-' ? '0' : shortened, exactValue: null, overwriteNext: false, awaitingOperand: false };
    }

    case 'CLEAR':
      return { ...state, currentValue: '0', exactValue: null, error: null, overwriteNext: false, awaitingOperand: false };

    case 'ALL_CLEAR':
      return { ...initialState, isScientificMode: state.isScientificMode };

    case 'TOGGLE_MODE':
      return { ...state, isScientificMode: !state.isScientificMode };

    default:
      return state;
  }
};

const ERROR_SAFE: CalculatorAction['type'][] = ['ALL_CLEAR', 'CLEAR', 'TOGGLE_MODE'];

export const reducer = (state: CalculatorState, action: CalculatorAction): CalculatorState => {
  if (state.error && !ERROR_SAFE.includes(action.type)) return state;
  try {
    return calculate(state, action);
  } catch {
    return errorState(state);
  }
};

const KEY_ACTIONS: Record<string, CalculatorAction> = {
  '.': { type: 'ADD_DECIMAL' },
  Enter: { type: 'EVALUATE' },
  '=': { type: 'EVALUATE' },
  Escape: { type: 'ALL_CLEAR' },
  Backspace: { type: 'DELETE' },
  Delete: { type: 'DELETE' },
};

const keyAction = (key: string): CalculatorAction | undefined => {
  if (/^[0-9]$/.test(key)) return { type: 'ADD_DIGIT', payload: key };
  if (OPERATORS.includes(key)) return { type: 'CHOOSE_OPERATOR', payload: key };
  return KEY_ACTIONS[key];
};

/** Keyboard events that a calculator should leave to the browser or a focused control. */
export const ignoreKeyEvent = (e: KeyboardEvent): boolean => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.defaultPrevented) return true;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return true;
  return e.key === 'Enter' && Boolean(target?.closest('button, a[href], [role="button"]'));
};

export const useCalculator = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [pressedDigit, setPressedDigit] = useState<string | null>(null);
  const pressStartedAt = useRef(0);
  const releaseTimer = useRef<number | undefined>(undefined);
  // The scientific keypad has its own keyboard handler.
  const scientific = useRef(state.isScientificMode);
  useEffect(() => { scientific.current = state.isScientificMode; }, [state.isScientificMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (scientific.current || ignoreKeyEvent(e)) return;
      const action = keyAction(e.key);
      if (!action) return;
      e.preventDefault();
      if (action.type === 'ADD_DIGIT') {
        window.clearTimeout(releaseTimer.current);
        pressStartedAt.current = Date.now();
        setPressedDigit(action.payload);
      }
      dispatch(action);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!/^[0-9]$/.test(e.key)) return;
      const delay = Math.max(0, 140 - (Date.now() - pressStartedAt.current));
      window.clearTimeout(releaseTimer.current);
      releaseTimer.current = window.setTimeout(() => {
        setPressedDigit(current => current === e.key ? null : current);
      }, delay);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.clearTimeout(releaseTimer.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return { state, dispatch, pressedDigit };
};
