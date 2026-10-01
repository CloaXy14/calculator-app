import { afterEach, describe, it, expect } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCalculator, formatPending } from './useCalculator';
import type { CalculatorAction } from './useCalculator';

afterEach(cleanup);

const setup = () => {
  const { result } = renderHook(() => useCalculator());
  const dispatch = (...actions: CalculatorAction[]) => act(() => {
    actions.forEach(action => result.current.dispatch(action));
  });
  const digits = (value: string) => dispatch(...Array.from(value, payload => ({ type: 'ADD_DIGIT' as const, payload })));
  // Type an entry: digits, '.', the operators + - * / ^, and '=' to evaluate.
  const type = (keys: string) => Array.from(keys).forEach(key => {
    if (/[0-9]/.test(key)) digits(key);
    else if (key === '.') dispatch({ type: 'ADD_DECIMAL' });
    else if (key === '=') dispatch({ type: 'EVALUATE' });
    else dispatch({ type: 'CHOOSE_OPERATOR', payload: key });
  });
  const value = () => result.current.state.currentValue;
  return { result, dispatch, digits, type, value };
};

const keydown = (key: string, target: EventTarget = window, options: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  act(() => { target.dispatchEvent(event); });
  return event;
};

describe('standard calculator', () => {
  it('starts at zero with nothing pending', () => {
    const { result } = setup();
    expect(result.current.state).toMatchObject({ currentValue: '0', pending: null, isScientificMode: false, overwriteNext: false, awaitingOperand: false, error: null });
  });

  it('limits input to 30 digits and rejects non-digit payloads', () => {
    const { digits, dispatch, value } = setup();
    dispatch({ type: 'ADD_DIGIT', payload: 'F1' }, { type: 'ADD_DIGIT', payload: '12' });
    expect(value()).toBe('0');
    digits('1'.repeat(100));
    expect(value()).toBe('1'.repeat(30));
  });

  it('deletes individual digits and supports negative operands', () => {
    const { digits, dispatch, value } = setup();
    digits('123');
    dispatch({ type: 'DELETE' });
    expect(value()).toBe('12');
    dispatch({ type: 'TOGGLE_SIGN' });
    expect(value()).toBe('-12');
    dispatch({ type: 'DELETE' }, { type: 'DELETE' });
    expect(value()).toBe('0');
    digits('2');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' }, { type: 'TOGGLE_SIGN' });
    digits('3');
    expect(value()).toBe('-3');
    dispatch({ type: 'EVALUATE' });
    expect(value()).toBe('-1');
  });

  it('executes operations immediately, left to right', () => {
    const { type, value } = setup();
    type('2+3*4=');
    expect(value()).toBe('20');
    type('2*3+');
    expect(value()).toBe('6');
  });

  it('shows the pending operand and operator', () => {
    const { result, type } = setup();
    type('12+');
    expect(formatPending(result.current.state.pending)).toBe('12 +');
    type('3*');
    expect(formatPending(result.current.state.pending)).toBe('15 ×');
    expect(formatPending(null)).toBe('');
  });

  // Changed: switching modes no longer shares one calculation. The scientific mode is a separate
  // fx-991ES-style calculator, so the standard calculation simply waits until you come back.
  it('keeps the pending calculation across a round trip to scientific mode', () => {
    const { result, digits, dispatch, value } = setup();
    digits('12');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' }, { type: 'TOGGLE_MODE' });
    expect(result.current.state.isScientificMode).toBe(true);
    dispatch({ type: 'TOGGLE_MODE' });
    digits('3');
    dispatch({ type: 'EVALUATE' });
    expect(value()).toBe('15');
    dispatch({ type: 'TOGGLE_MODE' }, { type: 'ALL_CLEAR' });
    expect(result.current.state).toMatchObject({ currentValue: '0', isScientificMode: true, pending: null });
  });

  it('formats results to 30 significant digits and keeps large values compact', () => {
    const { digits, dispatch, type, value } = setup();
    type('1/3=');
    expect(value()).toBe('0.' + '3'.repeat(30));
    type('10^99=');
    expect(value()).toBe('1e+99');
    type('*2=');
    expect(value()).toBe('2e+99');
    dispatch({ type: 'ALL_CLEAR' });
    digits('123456789012345');
    dispatch({ type: 'ADD_DECIMAL' });
    expect(value()).toBe('123456789012345.');
  });

  it('keeps guard digits so 1 ÷ 3 × 3 returns 1', () => {
    const { type, value } = setup();
    type('1/3*3=');
    expect(value()).toBe('1');
  });

  it('negates a result with its guard digits and toggles a typed sign back', () => {
    const { dispatch, digits, type, value } = setup();
    type('1/3=');
    dispatch({ type: 'TOGGLE_SIGN' });
    type('*3=');
    expect(value()).toBe('-1');
    dispatch({ type: 'ALL_CLEAR' });
    digits('12');
    dispatch({ type: 'TOGGLE_SIGN' }, { type: 'TOGGLE_SIGN' });
    expect(value()).toBe('12');
  });

  it('starts a fresh decimal after a result or an operator', () => {
    const { dispatch, digits, type, value } = setup();
    type('2+3=');
    dispatch({ type: 'ADD_DECIMAL' });
    digits('5');
    expect(value()).toBe('0.5');
    type('+.5=');
    expect(value()).toBe('1');
  });

  it('keeps the typed entry unchanged when an operator only queues it', () => {
    const { type, value } = setup();
    type('1.50+');
    expect(value()).toBe('1.50');
  });

  it('deletes down to zero and keeps typing after a deletion', () => {
    const { dispatch, digits, value } = setup();
    digits('5');
    dispatch({ type: 'DELETE' });
    expect(value()).toBe('0');
    digits('12');
    dispatch({ type: 'DELETE' });
    digits('3');
    expect(value()).toBe('13');
  });

  it('replaces an operator and clears the current entry', () => {
    const { result, digits, dispatch, value } = setup();
    digits('8');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' }, { type: 'CHOOSE_OPERATOR', payload: '*' }, { type: 'CHOOSE_OPERATOR', payload: 'x' });
    digits('99');
    dispatch({ type: 'CLEAR' });
    expect(value()).toBe('0');
    expect(formatPending(result.current.state.pending)).toBe('8 ×');
    digits('3');
    dispatch({ type: 'EVALUATE' });
    expect(value()).toBe('24');
  });

  // Changed: overflow now starts above 1e9999 (was above ~1.8e308).
  it('reports overflow and division errors, then accepts a fresh calculation', () => {
    const { result, digits, dispatch, type } = setup();
    type('9^99999=');
    expect(result.current.state).toMatchObject({ currentValue: 'Error', error: 'Error' });
    digits('5');
    expect(result.current.state.currentValue).toBe('Error');
    dispatch({ type: 'CLEAR' });
    type('5/0+');
    expect(result.current.state).toMatchObject({ currentValue: 'Error', pending: null });
    dispatch({ type: 'TOGGLE_MODE' }, { type: 'TOGGLE_MODE' }, { type: 'CLEAR' });
    digits('7');
    expect(result.current.state).toMatchObject({ currentValue: '7', error: null });
  });

  it('ignores equals when nothing is pending', () => {
    const { dispatch, digits, value } = setup();
    digits('42');
    dispatch({ type: 'EVALUATE' });
    expect(value()).toBe('42');
  });
});

describe('standard keyboard', () => {
  it('handles keyboard shortcuts without consuming unrelated or modified keys', () => {
    const { value } = setup();
    expect(keydown('F1').defaultPrevented).toBe(false);
    expect(keydown('1', window, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(keydown('2', window, { metaKey: true }).defaultPrevented).toBe(false);
    expect(keydown('3', window, { altKey: true }).defaultPrevented).toBe(false);
    expect(value()).toBe('0');
    expect(keydown('1').defaultPrevented).toBe(true);
    keydown('2');
    expect(keydown('Backspace').defaultPrevented).toBe(true);
    expect(value()).toBe('1');
    expect(keydown('+').defaultPrevented).toBe(true);
    keydown('2');
    expect(keydown('Enter').defaultPrevented).toBe(true);
    expect(value()).toBe('3');
  });

  it('maps the remaining keyboard keys', () => {
    const { value } = setup();
    for (const key of ['9', '-', '3', '*', '2', '/', '3', '=']) keydown(key);
    expect(value()).toBe('4');
    keydown('4');
    keydown('Delete');
    expect(value()).toBe('0');
    for (const key of ['2', '.', '5', 'Escape']) keydown(key);
    expect(value()).toBe('0');
  });

  it('leaves the keyboard to the scientific calculator in scientific mode', () => {
    const { dispatch, value } = setup();
    dispatch({ type: 'TOGGLE_MODE' });
    expect(keydown('7').defaultPrevented).toBe(false);
    expect(value()).toBe('0');
  });

  it('leaves editable fields and Enter on buttons to their native behavior', () => {
    const { result, digits, dispatch } = setup();
    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const button = document.createElement('button');
    document.body.append(input, editable, button);
    try {
      expect(keydown('7', input).defaultPrevented).toBe(false);
      expect(keydown('8', editable).defaultPrevented).toBe(false);
      expect(result.current.state.currentValue).toBe('0');
      digits('2');
      dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' });
      digits('3');
      button.focus();
      expect(keydown('Enter', button).defaultPrevented).toBe(false);
      expect(result.current.state.currentValue).toBe('3');
      expect(formatPending(result.current.state.pending)).toBe('2 +');
    } finally {
      input.remove(); editable.remove(); button.remove();
    }
  });
});
