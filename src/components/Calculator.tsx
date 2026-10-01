import { useState } from 'react';
import { formatPending, useCalculator } from '../hooks/useCalculator';
import { useCasio } from '../casio/useCasio';
import { CasioDisplay } from './CasioDisplay';
import { CasioKeypad } from './CasioKeypad';
import { Display } from './Display';
import { Keypad } from './Keypad';
import { ModeToggle } from './ModeToggle';

export const Calculator = () => {
  const { state, dispatch, pressedDigit } = useCalculator();
  const scientific = state.isScientificMode;
  const casio = useCasio(scientific);
  const [view, setView] = useState<'2d' | '3d'>('3d');
  return (
    <div className="calculator-wrap" data-view={view}>
      <section className={`calculator ${scientific ? 'calculator--scientific' : ''}`} aria-label={`${scientific ? 'Scientific' : 'Standard'} calculator`}>
        <div className="device-controls">
          <ModeToggle isScientific={scientific} onToggle={() => dispatch({ type: 'TOGGLE_MODE' })} />
          <div className="view-toggle" role="group" aria-label="Calculator appearance">
            <button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D</button>
            <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button>
          </div>
        </div>
        <div className="device-topline"><div><span className="device-brand">forma<span>®</span></span><span className="device-model">{scientific ? 'SC–991 / 2-LINE SCIENTIFIC' : 'ST–01 / STANDARD'}</span></div><div className="solar-panel" aria-hidden="true"><i /><i /><i /><i /></div></div>
        {scientific
          ? <CasioDisplay view={casio.view} />
          : <Display currentValue={state.currentValue} expression={formatPending(state.pending)} error={state.error} />}
        <div className="device-label"><span>{scientific ? 'LINE I/O · 30-DIGIT' : 'ELECTRONIC CALCULATOR'}</span><span className="power-indicator"><i />{scientific && !casio.state.on ? 'OFF' : 'READY'}</span></div>
        {scientific
          ? <CasioKeypad press={casio.press} shift={casio.state.modifier === 'shift'} alpha={casio.state.modifier === 'alpha'} pressedKey={casio.pressedKey} />
          : <Keypad dispatch={dispatch} pressedDigit={pressedDigit} />}
        <div className="device-bottom" aria-hidden="true"><span className="screw" /><span className="grip"><i /><i /><i /></span><span className="screw" /></div>
      </section>
    </div>
  );
};
