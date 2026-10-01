interface DisplayProps {
  currentValue: string;
  expression: string;
  error: string | null;
}

/** Single-line display of the standard calculator. */
export const Display = ({ currentValue, expression, error }: DisplayProps) => {
  const value = error || currentValue;
  return (
    <div className="display-bezel">
      <div className={`lcd ${error ? 'lcd--error' : ''}`}>
        <div className="lcd-indicators" aria-hidden="true"><span>COMP<b>DEC</b></span><span>ƒ<span className="battery-icon" /></span></div>
        <div className="lcd-readout" role="status" aria-live="polite" aria-atomic="true" aria-label="Calculator display">
          <div className="display-expression">{expression || '\u00a0'}</div>
          <div className="display-value" style={{ fontSize: `min(43px, ${180 / Math.max(value.length, 1)}cqi)` }}>{value}</div>
        </div>
        <div className="lcd-baseline" aria-hidden="true"><span>{error ? 'PRESS C OR AC TO RESET' : '········································'}</span><span>{error ? '!' : '='}</span></div>
      </div>
    </div>
  );
};
