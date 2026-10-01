import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { initialCasio, press, view } from './engine';
import type { CasioState, Key } from './engine';
import { ignoreKeyEvent } from '../hooks/useCalculator';

const reducer = (state: CasioState, action: { key: Key; seed: number }) => press(state, action.key, action.seed);

/** Computer keyboard → calculator key sequence. */
const KEYBOARD: Record<string, Key[]> = {
  '.': ['dot'], '+': ['plus'], '-': ['minus'], '*': ['times'], '/': ['divide'], '^': ['power'],
  '(': ['open'], ')': ['close'], ',': ['shift', 'close'], '%': ['shift', 'open'], '!': ['shift', 'inv'],
  Enter: ['equals'], '=': ['equals'], Backspace: ['del'], Delete: ['del'], Escape: ['ac'],
  ArrowLeft: ['left'], ArrowRight: ['right'], ArrowUp: ['up'], ArrowDown: ['down'],
};

export const keyboardKeys = (key: string): Key[] | undefined =>
  (/^[0-9]$/.test(key) ? [key as Key] : KEYBOARD[key]);

export const useCasio = (active: boolean) => {
  const [state, dispatch] = useReducer(reducer, initialCasio);
  const pressKey = useCallback((key: Key) => dispatch({ key, seed: Math.random() }), []);
  const [pressedKey, setPressedKey] = useState<Key | null>(null);
  const pressStartedAt = useRef(0);
  const releaseTimer = useRef<number | undefined>(undefined);
  const enabled = useRef(active);
  useEffect(() => { enabled.current = active; }, [active]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled.current || ignoreKeyEvent(e)) return;
      const sequence = keyboardKeys(e.key);
      if (!sequence) return;
      e.preventDefault();
      sequence.forEach(pressKey);
      // Show the on-screen key going down, like the standard keypad (SHIFT combinations show the main key).
      window.clearTimeout(releaseTimer.current);
      pressStartedAt.current = Date.now();
      setPressedKey(sequence[sequence.length - 1]);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const sequence = keyboardKeys(e.key);
      if (!sequence) return;
      const released = sequence[sequence.length - 1];
      const delay = Math.max(0, 140 - (Date.now() - pressStartedAt.current));
      window.clearTimeout(releaseTimer.current);
      releaseTimer.current = window.setTimeout(() => {
        setPressedKey(current => (current === released ? null : current));
      }, delay);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.clearTimeout(releaseTimer.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [pressKey]);

  return { state, view: view(state), press: pressKey, pressedKey };
};
