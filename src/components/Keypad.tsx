import type { Dispatch } from 'react';
import { Button } from './ui/Button';
import type { CalculatorAction } from '../hooks/useCalculator';

interface KeypadProps { isScientificMode: boolean; angleMode: 'DEG' | 'RAD'; dispatch: Dispatch<CalculatorAction>; pressedDigit: string | null; }
export const Keypad = ({ isScientificMode, angleMode, dispatch, pressedDigit }: KeypadProps) => {
  const digit = (value: string) => dispatch({ type: 'ADD_DIGIT', payload: value });
  const operator = (value: string) => dispatch({ type: 'CHOOSE_OPERATOR', payload: value });
  const scientific = (payload: Extract<CalculatorAction, { type: 'APPLY_SCIENTIFIC' }>['payload']) => dispatch({ type: 'APPLY_SCIENTIFIC', payload });
  return (
    <div className="keypad">
      {isScientificMode && <div className="scientific-keypad" role="group" aria-label="Scientific functions">
        <Button variant="scientific" className="angle-key" aria-label={`Angle mode ${angleMode}. Switch to ${angleMode === 'RAD' ? 'degrees' : 'radians'}`} onClick={() => dispatch({ type: 'TOGGLE_ANGLE' })}>{angleMode}<span className="key-indicator" /></Button>
        <Button variant="scientific" aria-label="Square" onClick={() => scientific('square')}>x<sup>2</sup></Button>
        <Button variant="scientific" aria-label="Raise to power" onClick={() => scientific('pow')}>x<sup>y</sup></Button>
        <Button variant="scientific" aria-label="Square root" onClick={() => scientific('sqrt')}>√<span className="math-variable">x</span></Button>
        <Button variant="scientific" aria-label="Sine" onClick={() => scientific('sin')}>sin</Button>
        <Button variant="scientific" aria-label="Cosine" onClick={() => scientific('cos')}>cos</Button>
        <Button variant="scientific" aria-label="Tangent" onClick={() => scientific('tan')}>tan</Button>
        <Button variant="scientific" aria-label="Reciprocal" onClick={() => scientific('reciprocal')}>x<sup>−1</sup></Button>
        <Button variant="scientific" aria-label="Base 10 logarithm" onClick={() => scientific('log')}>log</Button>
        <Button variant="scientific" aria-label="Natural logarithm" onClick={() => scientific('ln')}>ln</Button>
        <Button variant="scientific" aria-label="Exponential" onClick={() => scientific('exp')}>e<sup>x</sup></Button>
        <Button variant="scientific" aria-label="10 to the power" onClick={() => scientific('pow10')}>10<sup>x</sup></Button>
      </div>}
      <div className="numeric-keypad" role="group" aria-label="Number pad">
        <Button variant="clear" aria-label="All clear" onClick={() => dispatch({ type: 'ALL_CLEAR' })}>AC</Button>
        <Button variant="operator" aria-label="Clear entry" onClick={() => dispatch({ type: 'CLEAR' })}>C</Button>
        <Button variant="operator" aria-label="Delete last digit" onClick={() => dispatch({ type: 'DELETE' })}><svg width="23" height="18" viewBox="0 0 24 18" fill="none" aria-hidden="true"><path d="M8 2H21V16H8L2 9L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M12 6L17 12M17 6L12 12" stroke="currentColor" strokeWidth="1.4" /></svg></Button>
        <Button variant="operator" aria-label="Divide" onClick={() => operator('/')}>÷</Button>
        {['7', '8', '9'].map(n => <Button key={n} data-pressed={pressedDigit === n} onClick={() => digit(n)}>{n}</Button>)}
        <Button variant="operator" aria-label="Multiply" onClick={() => operator('*')}>×</Button>
        {['4', '5', '6'].map(n => <Button key={n} data-pressed={pressedDigit === n} onClick={() => digit(n)}>{n}</Button>)}
        <Button variant="operator" aria-label="Subtract" onClick={() => operator('-')}>−</Button>
        {['1', '2', '3'].map(n => <Button key={n} data-pressed={pressedDigit === n} onClick={() => digit(n)}>{n}</Button>)}
        <Button variant="operator" aria-label="Add" onClick={() => operator('+')}>+</Button>
        <Button aria-label="Change sign" onClick={() => dispatch({ type: 'TOGGLE_SIGN' })}>±</Button>
        <Button data-pressed={pressedDigit === '0'} onClick={() => digit('0')}>0</Button>
        <Button aria-label="Decimal point" onClick={() => dispatch({ type: 'ADD_DECIMAL' })}>.</Button>
        <Button variant="primary" aria-label="Equals" onClick={() => dispatch({ type: 'EVALUATE' })}>=</Button>
      </div>
      {isScientificMode && <div className="constant-row" role="group" aria-label="Mathematical constants"><span>CONSTANTS</span><button type="button" aria-label="Pi" onClick={() => dispatch({ type: 'SET_CONSTANT', payload: 'pi' })}>π</button><button type="button" aria-label="Euler's number" onClick={() => dispatch({ type: 'SET_CONSTANT', payload: 'e' })}>e</button><span>ENTER VALUE, THEN FUNCTION</span></div>}
    </div>
  );
};
