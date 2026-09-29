import { afterEach, describe, it, expect } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCalculator } from './useCalculator';
import type { CalculatorAction } from './useCalculator';

afterEach(cleanup);

const setup = () => {
  const { result } = renderHook(() => useCalculator());
  const dispatch = (...actions: CalculatorAction[]) => act(() => {
    actions.forEach(action => result.current.dispatch(action));
  });
  const digits = (value: string) => dispatch(...Array.from(value, payload => ({ type: 'ADD_DIGIT' as const, payload })));
  return { result, dispatch, digits };
};

const keydown = (key: string, target: EventTarget = window, options: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  act(() => { target.dispatchEvent(event); });
  return event;
};

describe('useCalculator hook', () => {
  it('limits input to 15 digits and rejects non-digit payloads', () => {
    const { result, digits, dispatch } = setup();
    dispatch({ type: 'ADD_DIGIT', payload: 'F1' });
    expect(result.current.state.currentValue).toBe('0');
    digits('1'.repeat(100));
    expect(result.current.state.currentValue).toBe('1'.repeat(15));
  });

  it('deletes individual digits and supports negative operands', () => {
    const { result, digits, dispatch } = setup();
    digits('123');
    dispatch({ type: 'DELETE' });
    expect(result.current.state.currentValue).toBe('12');
    dispatch({ type: 'TOGGLE_SIGN' });
    expect(result.current.state.currentValue).toBe('-12');
    dispatch({ type: 'DELETE' }, { type: 'DELETE' });
    expect(result.current.state.currentValue).toBe('0');
    digits('2');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' }, { type: 'TOGGLE_SIGN' });
    digits('3');
    dispatch({ type: 'EVALUATE' });
    expect(result.current.state.currentValue).toBe('-1');
  });

  it('preserves pending arithmetic across mode changes and resets', () => {
    const { result, digits, dispatch } = setup();
    expect(result.current.state.angleMode).toBe('RAD');
    digits('12');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' }, { type: 'TOGGLE_MODE' }, { type: 'TOGGLE_ANGLE' });
    expect(result.current.state).toMatchObject({ previousValue: '12', currentValue: '12', operator: '+', angleMode: 'DEG', isScientificMode: true });
    digits('3');
    dispatch({ type: 'EVALUATE' });
    expect(result.current.state.currentValue).toBe('15');
    dispatch({ type: 'ALL_CLEAR' });
    expect(result.current.state).toMatchObject({ currentValue: '0', angleMode: 'DEG', isScientificMode: true });
  });

  it('evaluates constants and trigonometry in the selected angle mode', () => {
    const { result, digits, dispatch } = setup();
    dispatch({ type: 'SET_CONSTANT', payload: 'pi' }, { type: 'CHOOSE_OPERATOR', payload: '/' });
    digits('2');
    dispatch({ type: 'EVALUATE' }, { type: 'APPLY_SCIENTIFIC', payload: 'sin' });
    expect(Number(result.current.state.currentValue)).toBeCloseTo(1);
    dispatch({ type: 'TOGGLE_ANGLE' });
    digits('30');
    dispatch({ type: 'APPLY_SCIENTIFIC', payload: 'sin' });
    expect(result.current.state.currentValue).toBe('0.5');
    dispatch({ type: 'SET_CONSTANT', payload: 'e' }, { type: 'APPLY_SCIENTIFIC', payload: 'ln' });
    expect(result.current.state.currentValue).toBe('1');
  });

  it('formats computed results to 15 significant digits and keeps large values compact', () => {
    const { result, digits, dispatch } = setup();
    dispatch({ type: 'SET_CONSTANT', payload: 'pi' });
    expect(result.current.state.currentValue).toBe('3.14159265358979');
    digits('1');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '/' });
    digits('3');
    dispatch({ type: 'EVALUATE' });
    expect(result.current.state.currentValue).toBe('0.333333333333333');
    digits('99');
    dispatch({ type: 'APPLY_SCIENTIFIC', payload: 'pow10' });
    expect(result.current.state.currentValue).toBe('1e+99');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '*' });
    digits('2');
    dispatch({ type: 'EVALUATE' });
    expect(result.current.state.currentValue).toBe('2e+99');
    dispatch({ type: 'ALL_CLEAR' });
    digits('123456789012345');
    dispatch({ type: 'ADD_DECIMAL' });
    expect(result.current.state.currentValue).toBe('123456789012345.');
  });

  it('chains unary and power operations without dropping pending arithmetic', () => {
    const { result, digits, dispatch } = setup();
    digits('2');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' });
    digits('3');
    dispatch({ type: 'APPLY_SCIENTIFIC', payload: 'square' }, { type: 'APPLY_SCIENTIFIC', payload: 'pow' });
    digits('2');
    dispatch({ type: 'EVALUATE' });
    expect(result.current.state.currentValue).toBe('121');
    dispatch({ type: 'DELETE' });
    expect(result.current.state.currentValue).toBe('0');
  });

  it('recovers through CLEAR after invalid domains and overflow', () => {
    const { result, digits, dispatch } = setup();
    dispatch({ type: 'APPLY_SCIENTIFIC', payload: 'reciprocal' });
    expect(result.current.state.error).toBe('Error');
    dispatch({ type: 'CLEAR' });
    digits('309');
    dispatch({ type: 'APPLY_SCIENTIFIC', payload: 'pow10' });
    expect(result.current.state).toMatchObject({ currentValue: 'Error', error: 'Error', previousValue: null, operator: null });
    dispatch({ type: 'CLEAR' });
    digits('4');
    dispatch({ type: 'APPLY_SCIENTIFIC', payload: 'square' });
    expect(result.current.state).toMatchObject({ currentValue: '16', error: null });
  });

  it('reports binary overflow and division errors, then accepts a fresh calculation', () => {
    const { result, digits, dispatch } = setup();
    digits('9');
    dispatch({ type: 'APPLY_SCIENTIFIC', payload: 'pow' });
    digits('999');
    dispatch({ type: 'EVALUATE' });
    expect(result.current.state).toMatchObject({ currentValue: 'Error', error: 'Error' });
    dispatch({ type: 'CLEAR' });
    digits('5');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '/' });
    digits('0');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' });
    expect(result.current.state).toMatchObject({ currentValue: 'Error', previousValue: null, operator: null });
    dispatch({ type: 'CLEAR' });
    digits('7');
    expect(result.current.state).toMatchObject({ currentValue: '7', error: null });
  });

  it('replaces an operator and clears the current entry', () => {
    const { result, digits, dispatch } = setup();
    digits('8');
    dispatch({ type: 'CHOOSE_OPERATOR', payload: '+' }, { type: 'CHOOSE_OPERATOR', payload: '*' });
    digits('99');
    dispatch({ type: 'CLEAR' });
    digits('3');
    dispatch({ type: 'EVALUATE' });
    expect(result.current.state.currentValue).toBe('24');
  });

  it('handles keyboard shortcuts without consuming unrelated or modified keys', () => {
    const { result } = setup();
    expect(keydown('F1').defaultPrevented).toBe(false);
    expect(keydown('1', window, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(keydown('2', window, { metaKey: true }).defaultPrevented).toBe(false);
    expect(keydown('3', window, { altKey: true }).defaultPrevented).toBe(false);
    expect(result.current.state.currentValue).toBe('0');
    expect(keydown('1').defaultPrevented).toBe(true);
    keydown('2');
    expect(keydown('Backspace').defaultPrevented).toBe(true);
    expect(result.current.state.currentValue).toBe('1');
    expect(keydown('+').defaultPrevented).toBe(true);
    keydown('2');
    expect(keydown('Enter').defaultPrevented).toBe(true);
    expect(result.current.state.currentValue).toBe('3');
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
      expect(result.current.state).toMatchObject({ currentValue: '3', operator: '+' });
    } finally {
      input.remove(); editable.remove(); button.remove();
    }
  });
});
