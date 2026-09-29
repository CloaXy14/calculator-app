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

  it('preserves a pending calculation when switching modes in either direction', () => {
    render(<App />);
    press('1', '2', 'Add', 'Scientific');
    expectDisplay('12');
    expect(screen.getByRole('region', { name: 'Scientific calculator' })).toBeTruthy();
    press('3', 'Standard', 'Equals');
    expectDisplay('15');
    expect(screen.queryByRole('group', { name: 'Scientific functions' })).toBeNull();
  });

  it('evaluates square roots and two-operand powers using scientific keys', () => {
    render(<App />);
    press('Scientific', '9', 'Square root');
    expectDisplay('3');
    press('All clear', '2', 'Raise to power', '3', 'Equals');
    expectDisplay('8');
  });

  it('exposes the angle setting and evaluates sine in degrees', () => {
    render(<App />);
    press('Scientific', 'Angle mode RAD. Switch to degrees', '3', '0', 'Sine');
    expectDisplay('0.5');
    expect(screen.getByRole('button', { name: 'Angle mode DEG. Switch to radians' })).toBeTruthy();
  });

  it('shows domain errors and recovers through the visible clear controls', () => {
    render(<App />);
    press('Scientific', '9', 'Change sign', 'Square root');
    expectDisplay('Error');
    press('Clear entry', '4', 'Square root');
    expectDisplay('2');
    press('Divide', '0', 'Equals');
    expectDisplay('Error');
    press('All clear', '5', 'Add', '7', 'Equals');
    expectDisplay('12');
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

  it('retains the full bounded input in its announced display', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('12345678901234567890');
    expectDisplay('123456789012345');
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});
