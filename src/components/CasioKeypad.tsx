import type { ReactNode } from 'react';
import type { Key } from '../casio/engine';

interface Face {
  key: Key;
  name: string;
  label: ReactNode;
  /** Printed above the key: SHIFT function (left, gold) and ALPHA function (right, red). */
  shift?: ReactNode;
  alpha?: ReactNode;
  /** Printed functions of modes this calculator does not have (shown faded, like a decal). */
  unavailable?: boolean;
  variant?: 'fn' | 'num' | 'operator' | 'del' | 'shift' | 'alpha' | 'on' | 'equals';
}

const k = (key: Key, name: string, label: ReactNode, extra: Partial<Face> = {}): Face => ({ key, name, label, variant: 'fn', ...extra });
const box = <span className="key-box" aria-hidden="true" />;

const TOP: Face[] = [
  k('calc', 'Calc', 'CALC', { shift: 'SOLVE', alpha: '=' }),
  k('integral', 'Integral', <>∫<small>dx</small></>, { shift: <><i>d</i>/<i>dx</i></>, alpha: ':' }),
  k('inv', 'Reciprocal', <>x<sup>−1</sup></>, { shift: 'x!' }),
  k('logab', 'Logarithm with base', <>log<sub>{box}</sub>{box}</>, { shift: 'Σ' }),
];

const FUNCTIONS: Face[] = [
  k('frac', 'Fraction', <span className="frac-glyph">{box}<b />{box}</span>),
  k('sqrt', 'Square root', <>√{box}</>, { shift: '∛' }),
  k('square', 'Square', <>x<sup>2</sup></>, { shift: <>x<sup>3</sup></> }),
  k('power', 'Power', <>x<sup>{box}</sup></>, { shift: <><sup>x</sup>√</> }),
  k('log', 'Logarithm', 'log', { shift: <>10<sup>x</sup></> }),
  k('ln', 'Natural logarithm', 'ln', { shift: <>e<sup>x</sup></> }),
  k('neg', 'Negative', '(−)', { shift: '∠', alpha: 'A', unavailable: true }),
  k('dms', 'Degrees minutes seconds', <>°&prime;&Prime;</>, { shift: 'FACT', alpha: 'B' }),
  k('hyp', 'Hyperbolic', 'hyp', { shift: 'Abs', alpha: 'C' }),
  k('sin', 'Sine', 'sin', { shift: <>sin<sup>−1</sup></>, alpha: 'D' }),
  k('cos', 'Cosine', 'cos', { shift: <>cos<sup>−1</sup></>, alpha: 'E' }),
  k('tan', 'Tangent', 'tan', { shift: <>tan<sup>−1</sup></>, alpha: 'F' }),
  k('rcl', 'Recall', 'RCL', { shift: 'STO' }),
  k('eng', 'Engineering notation', 'ENG', { shift: '←' }),
  k('open', 'Open parenthesis', '(', { shift: '%', alpha: 'X' }),
  k('close', 'Close parenthesis', ')', { shift: ',', alpha: 'Y' }),
  k('sd', 'Fraction decimal toggle', 'S⇔D', { shift: <>a<sup>b</sup>/<sub>c</sub>⇔<sup>d</sup>/<sub>c</sub></> }),
  k('mplus', 'Memory add', 'M+', { shift: 'M−', alpha: 'M' }),
];

const n = (key: Key, label: string, extra: Partial<Face> = {}) => k(key, label, label, { variant: 'num', ...extra });

const NUMBERS: Face[] = [
  n('7', '7', { shift: 'CONST', unavailable: true }), n('8', '8', { shift: 'CONV', unavailable: true }), n('9', '9', { shift: 'CLR' }),
  k('del', 'Delete', 'DEL', { shift: 'INS', variant: 'del' }), k('ac', 'All clear', 'AC', { shift: 'OFF', variant: 'del' }),
  n('4', '4', { shift: 'MATRIX', unavailable: true }), n('5', '5', { shift: 'VECTOR', unavailable: true }), n('6', '6'),
  k('times', 'Multiply', '×', { shift: 'nPr', variant: 'operator' }), k('divide', 'Divide', '÷', { shift: 'nCr', variant: 'operator' }),
  n('1', '1', { shift: 'STAT', unavailable: true }), n('2', '2', { shift: 'CMPLX', unavailable: true }), n('3', '3', { shift: 'BASE', unavailable: true }),
  k('plus', 'Add', '+', { shift: 'Pol', variant: 'operator' }), k('minus', 'Subtract', '−', { shift: 'Rec', variant: 'operator' }),
  n('0', '0', { shift: 'Rnd' }), k('dot', 'Decimal point', '.', { shift: 'Ran#', alpha: 'RanInt', variant: 'num' }),
  k('exp', 'Times ten to the power', <>×10<sup>x</sup></>, { shift: 'π', alpha: 'e', variant: 'num' }),
  k('ans', 'Answer', 'Ans', { shift: 'DRG▶', variant: 'num' }), k('equals', 'Equals', '=', { variant: 'equals' }),
];

const describe = (face: Face) => {
  const text = (node: ReactNode) => (typeof node === 'string' ? node : null);
  const parts = [face.name];
  if (face.shift && !face.unavailable && text(face.shift)) parts.push(`SHIFT ${text(face.shift)}`);
  if (face.alpha && text(face.alpha)) parts.push(`ALPHA ${text(face.alpha)}`);
  return parts.join('. ');
};

interface CasioKeypadProps {
  press: (key: Key) => void;
  shift: boolean;
  alpha: boolean;
  /** Key currently held on the computer keyboard; shown pressed like a click. */
  pressedKey: Key | null;
}

export const CasioKeypad = ({ press, shift, alpha, pressedKey }: CasioKeypadProps) => {
  const key = (face: Face) => (
    <div className="casio-cell" key={face.key}>
      <span className="casio-legend" aria-hidden="true">
        <span className={`legend-shift ${face.unavailable ? 'legend--unavailable' : ''}`}>{face.shift}</span>
        <span className="legend-alpha">{face.alpha}</span>
      </span>
      <button type="button" className={`casio-key casio-key--${face.variant}`} aria-label={face.name} title={describe(face)} data-pressed={pressedKey === face.key} onClick={() => press(face.key)}>
        <span>{face.label}</span>
      </button>
    </div>
  );

  return (
    <div className="casio-keypad">
      <div className="casio-top" role="group" aria-label="Function keys">
        <div className="casio-cell casio-cell--modifier">
          <span className="casio-legend" aria-hidden="true" />
          <button type="button" className="casio-key casio-key--shift" aria-label="Shift" aria-pressed={shift} onClick={() => press('shift')}><span>SHIFT</span></button>
        </div>
        <div className="casio-cell casio-cell--modifier">
          <span className="casio-legend" aria-hidden="true" />
          <button type="button" className="casio-key casio-key--alpha" aria-label="Alpha" aria-pressed={alpha} onClick={() => press('alpha')}><span>ALPHA</span></button>
        </div>
        <div className="replay-pad" role="group" aria-label="Replay">
          <span className="replay-title" aria-hidden="true">REPLAY</span>
          <button type="button" className="replay-key replay-key--up" aria-label="Up" data-pressed={pressedKey === 'up'} onClick={() => press('up')}>▲</button>
          <button type="button" className="replay-key replay-key--left" aria-label="Left" data-pressed={pressedKey === 'left'} onClick={() => press('left')}>◀</button>
          <button type="button" className="replay-key replay-key--right" aria-label="Right" data-pressed={pressedKey === 'right'} onClick={() => press('right')}>▶</button>
          <button type="button" className="replay-key replay-key--down" aria-label="Down" data-pressed={pressedKey === 'down'} onClick={() => press('down')}>▼</button>
        </div>
        {key(k('mode', 'Mode', 'MODE', { shift: 'SETUP' }))}
        {key(k('on', 'On', 'ON', { variant: 'on' }))}
        {TOP.map(key)}
      </div>
      <div className="casio-functions" role="group" aria-label="Scientific functions">{FUNCTIONS.map(key)}</div>
      <div className="casio-numbers" role="group" aria-label="Number pad">{NUMBERS.map(key)}</div>
    </div>
  );
};
