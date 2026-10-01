import type { View } from '../casio/engine';

/** Characters that fit on the input line before it scrolls (◀ ▶ indicators appear). */
const LINE_WIDTH = 24;

const visibleWindow = (text: string, cursor: number | null) => {
  const anchor = cursor ?? text.length;
  const start = Math.max(0, Math.min(anchor - LINE_WIDTH + 1, text.length - LINE_WIDTH));
  return { start, slice: text.slice(start, start + LINE_WIDTH), more: start + LINE_WIDTH < text.length };
};

export const CasioDisplay = ({ view }: { view: View }) => {
  if (view.off) {
    return (
      <div className="display-bezel">
        <div className="lcd lcd--casio lcd--off" role="status" aria-label="Calculator display">Off</div>
      </div>
    );
  }
  const { start, slice, more } = visibleWindow(view.top, view.cursor);
  const cursorAt = view.cursor === null ? null : view.cursor - start;
  const error = /ERROR|Can't Solve/.test(view.top);
  return (
    <div className="display-bezel">
      <div className={`lcd lcd--casio ${error ? 'lcd--error' : ''}`}>
        <div className="lcd-indicators casio-indicators" data-testid="lcd-indicators" aria-hidden="true">
          {view.indicators.map(indicator => <i key={indicator} className={`ind ind--${indicator.length > 1 ? 'word' : 'char'}`}>{indicator}</i>)}
        </div>
        <div className="lcd-readout" role="status" aria-live="polite" aria-atomic="true" aria-label="Calculator display">
          <div className="casio-line casio-line--input">
            {start > 0 && <span className="scroll-mark" aria-hidden="true">◀</span>}
            {cursorAt === null ? <span>{slice || '\u00a0'}</span> : (
              <>
                <span>{slice.slice(0, cursorAt)}</span>
                <span className={`lcd-cursor ${view.overwrite ? 'lcd-cursor--overwrite' : ''}`} aria-hidden="true">{view.overwrite ? slice[cursorAt] ?? ' ' : ''}</span>
                <span>{slice.slice(cursorAt + (view.overwrite ? 1 : 0))}</span>
              </>
            )}
            {more && <span className="scroll-mark scroll-mark--right" aria-hidden="true">▶</span>}
          </div>
          {view.extra.length > 0 && <div className="casio-lines">{view.extra.map(line => <div key={line}>{line}</div>)}</div>}
          <div className="casio-line casio-line--result" style={{ fontSize: `min(24px, ${120 / Math.max(view.bottom.length + (view.exponent === null ? 0 : 5), 1)}cqi)` }}>
            {view.bottomLabel && <span className="result-label">{view.bottomLabel}</span>}
            <span>{view.bottom || '\u00a0'}</span>
            {view.exponent !== null && <span className="result-exponent">×10<sup>{view.exponent}</sup></span>}
          </div>
        </div>
      </div>
    </div>
  );
};
