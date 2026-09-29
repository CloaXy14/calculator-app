interface ModeToggleProps { isScientific: boolean; onToggle: () => void; }

export const ModeToggle = ({ isScientific, onToggle }: ModeToggleProps) => (
  <div className="mode-toggle" role="group" aria-label="Calculator mode">
    <button type="button" aria-pressed={!isScientific} onClick={() => isScientific && onToggle()}>Standard</button>
    <button type="button" aria-pressed={isScientific} onClick={() => !isScientific && onToggle()}>Scientific</button>
  </div>
);
