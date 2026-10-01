import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

afterEach(cleanup);

const press = (...names: string[]) => names.forEach(name => {
  fireEvent.click(screen.getByRole('button', { name }));
});

const expectDisplay = (value: string) => {
  const display = screen.getByRole('status', { name: 'Calculator display' });
  expect(within(display).getByText(value, { exact: true })).toBeTruthy();
};


/** Text of each scientific LCD line (input, menu lines, result), with spaces collapsed. */
const lcdLines = () => Array.from(screen.getByRole('status', { name: 'Calculator display' })
  .querySelectorAll('.casio-line, .casio-lines > div'), line => (line.textContent ?? '').replace(/\s+/g, ' ').trim());
const expectLine = (value: string) => expect(lcdLines()).toContain(value.replace(/\s+/g, ' '));

describe('calculator interface', () => {
  it('switches between flat and physical views without losing calculations', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: '3D', pressed: true })).toBeTruthy();
    press('5', 'Add', '2D');
    expect(screen.getByRole('button', { name: '2D', pressed: true })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Standard calculator' }).closest('[data-view]')?.getAttribute('data-view')).toBe('2d');
    press('7', 'Equals', '3D');
    expectDisplay('12');
    expect(screen.getByRole('region', { name: 'Standard calculator' }).closest('[data-view]')?.getAttribute('data-view')).toBe('3d');
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });

  it('completes standard arithmetic through the visible number pad', () => {
    render(<App />);
    press('5', 'Add', '7', 'Equals');
    expectDisplay('12');
  });

  // Changed: each mode is now a separate calculator; switching keeps each calculation.
  it('keeps each mode\'s calculation when switching modes', () => {
    render(<App />);
    press('1', '2', 'Add', 'Scientific');
    expect(screen.getByRole('region', { name: 'Scientific calculator' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Scientific functions' })).toBeTruthy();
    press('4', 'Standard', '3', 'Equals');
    expectDisplay('15');
    expect(screen.queryByRole('group', { name: 'Scientific functions' })).toBeNull();
    press('Scientific', 'Equals');
    expectLine('4');
  });

  it('deletes only the last entered digit and keeps clear entry distinct from all clear', () => {
    render(<App />);
    press('1', '2', '3', 'Delete last digit');
    expectDisplay('12');
    press('Add', '9', 'Clear entry', '3', 'Equals');
    expectDisplay('15');
    press('Add', 'All clear', '8', 'Equals');
    expectDisplay('8');
  });

  it('supports a keyboard-only calculation, deletion, and reset', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('53{Backspace}+7{Enter}');
    expectDisplay('12');
    await user.keyboard('{Escape}0.1+0.2=');
    expectDisplay('0.3');
  });

  it('visually presses the matching number key while typing and releases it afterward', async () => {
    render(<App />);
    const seven = screen.getByRole('button', { name: '7' });
    const eight = screen.getByRole('button', { name: '8' });

    fireEvent.keyDown(window, { key: '7' });
    expect(seven.getAttribute('data-pressed')).toBe('true');
    expect(eight.getAttribute('data-pressed')).toBe('false');
    expectDisplay('7');

    fireEvent.keyUp(window, { key: '7' });
    await waitFor(() => expect(seven.getAttribute('data-pressed')).toBe('false'));

    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    fireEvent.keyDown(window, { key: '8' });
    expect(eight.getAttribute('data-pressed')).toBe('true');
    expectDisplay('78');
    fireEvent.keyUp(window, { key: '8' });
    await waitFor(() => expect(eight.getAttribute('data-pressed')).toBe('false'));
  });

  it('makes mode controls keyboard-operable and exposes their selected state', async () => {
    const user = userEvent.setup();
    render(<App />);
    const standard = screen.getByRole('button', { name: 'Standard', pressed: true });
    const scientific = screen.getByRole('button', { name: 'Scientific', pressed: false });
    standard.focus();
    await user.tab();
    expect(document.activeElement).toBe(scientific);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Scientific', pressed: true })).toBe(scientific);
    expect(screen.getByRole('group', { name: 'Scientific functions' })).toBeTruthy();
    await user.tab({ shift: true });
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Standard', pressed: true })).toBe(standard);
  });

  // Changed: the input limit was 15 digits; the requirement is now 30.
  it('retains the full bounded input in its announced display', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('12345678901234567890123456789012345');
    expectDisplay('123456789012345678901234567890');
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('evaluates a typed expression with precedence and shows input and result lines', () => {
    render(<App />);
    press('Scientific', '2', 'Add', '3', 'Multiply', '4', 'Equals');
    expectLine('2+3×4');
    expectLine('14');
  });

  it('uses SHIFT for printed second functions and releases it after one key', () => {
    render(<App />);
    press('Scientific', 'Shift');
    expect(screen.getByRole('button', { name: 'Shift', pressed: true })).toBeTruthy();
    expect(within(screen.getByTestId('lcd-indicators')).getByText('S')).toBeTruthy();
    press('Sine', '0', 'Decimal point', '5', 'Equals');
    expectLine('30');
    expect(screen.getByRole('button', { name: 'Shift', pressed: false })).toBeTruthy();
    press('5', 'Shift', 'Reciprocal', 'Equals');
    expectLine('120');
  });

  it('opens the hyperbolic menu with hyp', () => {
    render(<App />);
    press('Scientific', 'Hyperbolic');
    expectLine('1:sinh  2:cosh');
    press('2', '0', 'Equals');
    expectLine('1');
  });

  it('stores a value with STO and shows the memory indicator for M+', () => {
    render(<App />);
    press('Scientific', '4', 'Memory add');
    const indicators = screen.getByTestId('lcd-indicators');
    expect(within(indicators).getByText('M')).toBeTruthy();
    press('8', 'Shift', 'Recall', 'Negative');
    expectLine('8→A');
    press('Alpha', 'Negative', 'Multiply', 'Alpha', 'Memory add', 'Equals');
    expectLine('32');
  });

  it('shows Math ERROR and returns to the expression with the cursor keys', () => {
    render(<App />);
    press('Scientific', '1', 'Divide', '0', 'Equals');
    expectLine('Math ERROR');
    press('Left');
    expectLine('1÷0');
    expect(screen.getByRole('status', { name: 'Calculator display' }).querySelector('.lcd-cursor')).toBeTruthy();
  });

  it('switches the angle unit through SETUP', () => {
    render(<App />);
    press('Scientific', 'Shift', 'Mode');
    expectLine('4:Rad  5:Gra');
    press('4');
    expect(within(screen.getByTestId('lcd-indicators')).getByText('R')).toBeTruthy();
  });

  it('turns off with SHIFT AC and back on with ON', () => {
    render(<App />);
    press('Scientific', 'Shift', 'All clear');
    expect(screen.getByRole('status', { name: 'Calculator display' }).textContent).toBe('Off');
    press('On', '2', 'Add', '2', 'Equals');
    expectLine('4');
  });

  it('types into the scientific calculator from the keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);
    press('Scientific');
    await user.keyboard('2*(3+4){Enter}');
    expectLine('14');
    await user.keyboard('5!{Enter}');
    expectLine('120');
    await user.keyboard('{ArrowUp}');
    expectLine('14');
  });

  it('visually presses scientific keys while typing on the keyboard and releases them afterward', async () => {
    render(<App />);
    press('Scientific');
    const seven = screen.getByRole('button', { name: '7' });
    const plus = screen.getByRole('button', { name: 'Add' });
    const open = screen.getByRole('button', { name: 'Open parenthesis' });
    fireEvent.keyDown(window, { key: '7' });
    expect(seven.getAttribute('data-pressed')).toBe('true');
    expect(plus.getAttribute('data-pressed')).toBe('false');
    fireEvent.keyUp(window, { key: '7' });
    await waitFor(() => expect(seven.getAttribute('data-pressed')).toBe('false'));
    fireEvent.keyDown(window, { key: '+' });
    expect(plus.getAttribute('data-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: '%' });
    expect(open.getAttribute('data-pressed')).toBe('true');
    expect(plus.getAttribute('data-pressed')).toBe('false');
    fireEvent.keyUp(window, { key: '+' });
    fireEvent.keyUp(window, { key: 'q' });
    expect(open.getAttribute('data-pressed')).toBe('true');
    fireEvent.keyUp(window, { key: '%' });
    await waitFor(() => expect(open.getAttribute('data-pressed')).toBe('false'));
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(screen.getByRole('button', { name: 'Up' }).getAttribute('data-pressed')).toBe('true');
    expectLine('7+%');
  });
});
