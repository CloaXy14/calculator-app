import { useReducer, useEffect, useRef, useState } from 'react';
import { evaluate, evaluateScientific } from '../utils/math';
import type { AngleMode, ScientificOperation } from '../utils/math';

export interface CalculatorState {
  currentValue: string;
  previousValue: string | null;
  operator: string | null;
  isScientificMode: boolean;
  angleMode: AngleMode;
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
  | { type: 'SET_CONSTANT'; payload: 'pi' | 'e' }
  | { type: 'TOGGLE_MODE' }
  | { type: 'TOGGLE_ANGLE' }
  | { type: 'APPLY_SCIENTIFIC'; payload: ScientificOperation };

const initialState: CalculatorState = {
  currentValue: '0',
  previousValue: null,
  operator: null,
  isScientificMode: false,
  angleMode: 'RAD',
  overwriteNext: false,
  awaitingOperand: false,
  error: null,
};

// Keep computed values readable on the LCD without rounding manual input.
const formatResult = (value: number): string => Number(value.toPrecision(15)).toString();

const errorState = (state: CalculatorState): CalculatorState => ({
  ...state,
  currentValue: 'Error',
  previousValue: null,
  operator: null,
  awaitingOperand: false,
  error: 'Error',
});

const reducer = (state: CalculatorState, action: CalculatorAction): CalculatorState => {
  if (state.error && !['ALL_CLEAR', 'CLEAR', 'TOGGLE_MODE', 'TOGGLE_ANGLE'].includes(action.type)) return state;

  switch (action.type) {
    case 'ADD_DIGIT': {
      if (!/^[0-9]$/.test(action.payload)) return state;
      const next = { ...state, overwriteNext: false, awaitingOperand: false };
      if (state.overwriteNext || state.currentValue === '0') return { ...next, currentValue: action.payload };
      if (state.currentValue === '-0') return { ...next, currentValue: `-${action.payload}` };
      if (state.currentValue.replace(/[^0-9]/g, '').length >= 15) return state;
      return { ...next, currentValue: `${state.currentValue}${action.payload}` };
    }

    case 'ADD_DECIMAL':
      if (state.overwriteNext) return { ...state, currentValue: '0.', overwriteNext: false, awaitingOperand: false };
      if (state.currentValue.includes('.')) return state;
      return { ...state, currentValue: `${state.currentValue}.`, awaitingOperand: false };

    case 'CHOOSE_OPERATOR':
      if (!['+', '-', '*', '/', '^'].includes(action.payload)) return state;
      if (state.previousValue == null) {
        return { ...state, operator: action.payload, previousValue: state.currentValue, overwriteNext: true, awaitingOperand: true };
      }
      if (state.awaitingOperand) return { ...state, operator: action.payload };
      if (state.operator) {
        try {
          const result = formatResult(evaluate(Number(state.previousValue), Number(state.currentValue), state.operator));
          return { ...state, previousValue: result, currentValue: result, operator: action.payload, overwriteNext: true, awaitingOperand: true };
        } catch {
          return errorState(state);
        }
      }
      return state;

    case 'EVALUATE':
      if (state.operator == null || state.previousValue == null) return state;
      try {
        const result = evaluate(Number(state.previousValue), Number(state.currentValue), state.operator);
        return { ...state, currentValue: formatResult(result), previousValue: null, operator: null, overwriteNext: true, awaitingOperand: false };
      } catch {
        return errorState(state);
      }

    case 'APPLY_SCIENTIFIC':
      if (action.payload === 'pow') return reducer(state, { type: 'CHOOSE_OPERATOR', payload: '^' });
      try {
        const result = evaluateScientific(Number(state.currentValue), action.payload, undefined, state.angleMode);
        return { ...state, currentValue: formatResult(result), overwriteNext: true, awaitingOperand: false };
      } catch {
        return errorState(state);
      }

    case 'SET_CONSTANT':
      return { ...state, currentValue: formatResult(action.payload === 'pi' ? Math.PI : Math.E), overwriteNext: true, awaitingOperand: false };

    case 'TOGGLE_SIGN':
      if (state.awaitingOperand) return { ...state, currentValue: '-0', overwriteNext: false, awaitingOperand: false };
      return { ...state, currentValue: state.currentValue.startsWith('-') ? state.currentValue.slice(1) : `-${state.currentValue}`, awaitingOperand: false };

    case 'DELETE': {
      const shortened = state.overwriteNext || state.currentValue.includes('e') ? '0' : state.currentValue.slice(0, -1);
      return { ...state, currentValue: shortened === '' || shortened === '-' ? '0' : shortened, overwriteNext: false, awaitingOperand: false };
    }

    case 'CLEAR':
      return { ...state, currentValue: '0', error: null, overwriteNext: false, awaitingOperand: false };

    case 'ALL_CLEAR':
      return { ...initialState, isScientificMode: state.isScientificMode, angleMode: state.angleMode };

    case 'TOGGLE_MODE':
      return { ...state, isScientificMode: !state.isScientificMode };

    case 'TOGGLE_ANGLE':
      return { ...state, angleMode: state.angleMode === 'RAD' ? 'DEG' : 'RAD' };

    default:
      return state;
  }
};

export const useCalculator = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [pressedDigit, setPressedDigit] = useState<string | null>(null);
  const pressStartedAt = useRef(0);
  const releaseTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.defaultPrevented) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (e.key === 'Enter' && target?.closest('button, a[href], [role="button"]')) return;

      let action: CalculatorAction | undefined;
      if (/^[0-9]$/.test(e.key)) action = { type: 'ADD_DIGIT', payload: e.key };
      else if (e.key === '.') action = { type: 'ADD_DECIMAL' };
      else if (['+', '-', '*', '/', '^'].includes(e.key)) action = { type: 'CHOOSE_OPERATOR', payload: e.key };
      else if (e.key === 'Enter' || e.key === '=') action = { type: 'EVALUATE' };
      else if (e.key === 'Escape') action = { type: 'ALL_CLEAR' };
      else if (e.key === 'Backspace' || e.key === 'Delete') action = { type: 'DELETE' };
      if (action) {
        e.preventDefault();
        if (action.type === 'ADD_DIGIT') {
          window.clearTimeout(releaseTimer.current);
          pressStartedAt.current = Date.now();
          setPressedDigit(action.payload);
        }
        dispatch(action);
      }
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
