interface DisplayProps {
  currentValue: string;
  previousValue: string | null;
  operator: string | null;
  error: string | null;
  isScientific: boolean;
  angleMode: 'DEG' | 'RAD';
}
const operators: Record<string, string> = { '*': '×', '/': '÷', '-': '−', '^': '^' };
export const Display = ({ currentValue, previousValue, operator, error, isScientific, angleMode }: DisplayProps) => {
  const value = error || currentValue;
  return (
    <div className="display-bezel">
      <div className={`lcd ${error ? 'lcd--error' : ''}`}>
        <div className="lcd-indicators" aria-hidden="true"><span>{isScientific ? 'SCI' : 'COMP'}<b>{isScientific ? angleMode : 'DEC'}</b></span><span>ƒ<span className="battery-icon" /></span></div>
        <div className="lcd-readout" role="status" aria-live="polite" aria-atomic="true" aria-label="Calculator display">
          <div className="display-expression">{previousValue !== null ? `${previousValue} ${operators[operator || ''] || operator || ''}` : '\u00a0'}</div>
          <div className="display-value" style={{ fontSize: `min(43px, ${180 / Math.max(value.length, 1)}cqi)` }}>{value}</div>
        </div>
        <div className="lcd-baseline" aria-hidden="true"><span>{error ? 'PRESS C OR AC TO RESET' : '········································'}</span><span>{error ? '!' : '='}</span></div>
      </div>
    </div>
  );
};
