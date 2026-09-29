import { useState } from 'react';
import { useCalculator } from '../hooks/useCalculator';
import { Display } from './Display';
import { Keypad } from './Keypad';
import { ModeToggle } from './ModeToggle';

export const Calculator = () => {
  const { state, dispatch, pressedDigit } = useCalculator();
  const [view, setView] = useState<'2d' | '3d'>('3d');
  return (
    <div className="calculator-wrap" data-view={view}>
      <section className={`calculator ${state.isScientificMode ? 'calculator--scientific' : ''}`} aria-label={`${state.isScientificMode ? 'Scientific' : 'Standard'} calculator`}>
        <div className="device-controls">
          <ModeToggle isScientific={state.isScientificMode} onToggle={() => dispatch({ type: 'TOGGLE_MODE' })} />
          <div className="view-toggle" role="group" aria-label="Calculator appearance">
            <button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D</button>
            <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button>
          </div>
        </div>
        <div className="device-topline"><div><span className="device-brand">forma<span>®</span></span><span className="device-model">{state.isScientificMode ? 'SC–02 / SCIENTIFIC' : 'ST–01 / STANDARD'}</span></div><div className="solar-panel" aria-hidden="true"><i /><i /><i /><i /></div></div>
        <Display currentValue={state.currentValue} previousValue={state.previousValue} operator={state.operator} error={state.error} isScientific={state.isScientificMode} angleMode={state.angleMode} />
        <div className="device-label"><span>{state.isScientificMode ? 'SCIENTIFIC CALCULATOR' : 'ELECTRONIC CALCULATOR'}</span><span className="power-indicator"><i />READY</span></div>
        <Keypad isScientificMode={state.isScientificMode} angleMode={state.angleMode} dispatch={dispatch} pressedDigit={pressedDigit} />
        <div className="device-bottom" aria-hidden="true"><span className="screw" /><span className="grip"><i /><i /><i /></span><span className="screw" /></div>
      </section>
    </div>
  );
};
