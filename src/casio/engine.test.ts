import { describe, expect, it } from 'vitest';
import { initialCasio, press, view } from './engine';
import type { CasioState, Key } from './engine';

// Expected values are the worked examples from the Casio fx-991ES PLUS User's Guide (LineIO),
// unless noted. The real calculator shows 10 digits; this one shows up to 30.

/** Presses space-separated keys; a run of digits such as "30" presses each digit. */
const keys = (sequence: string, state: CasioState = initialCasio, seed = 0.5) =>
  sequence.split(/\s+/).filter(Boolean)
    .flatMap(key => (/^[0-9]+$/.test(key) ? key.split('') : [key]))
    .reduce((current, key) => press(current, key as Key, seed), state);

const result = (sequence: string, state?: CasioState) => view(keys(sequence, state));
const shown = (sequence: string, state?: CasioState) => {
  const v = result(sequence, state);
  return v.exponent === null ? v.bottom : `${v.bottom}×10^${v.exponent}`;
};

describe('basic input rules', () => {
  it('evaluates 4 × sin30 × (30 + 10 × 3) = 120 in degrees, with or without the omitted keys', () => {
    expect(shown('4 times sin 30 close times open 30 plus 10 times 3 close equals')).toBe('120');
    expect(shown('4 sin 30 close open 30 plus 10 times 3 equals')).toBe('120');
  });

  it('shows the input expression on the first line and the result on the second', () => {
    const v = result('4 sin 30 close open 30 plus 10 times 3 equals');
    expect(v.top).toBe('4sin(30)(30+10×3');
    expect(v.indicators).toContain('D');
  });

  it('applies the priority sequence: powers before negation, nPr before ×', () => {
    expect(shown('neg 2 square equals')).toBe('-4');
    expect(shown('open neg 2 close square equals')).toBe('4');
    expect(shown('2 times 10 shift times 2 equals')).toBe('180');
    expect(shown('2 power 3 close power 2 equals')).toBe('64');
  });

  it('reports a syntax error and returns to the error position with ◀', () => {
    const error = keys('2 plus times 3 equals');
    expect(view(error).top).toBe('Syntax ERROR');
    expect(view(error).extra).toEqual(['[AC] :Cancel', '[◀][▶]:Goto']);
    const editing = press(error, 'left');
    expect(view(editing).top).toBe('2+×3');
    expect(view(editing).cursor).toBe(2);
  });

  it('reports a math error for 14 ÷ 0 × 2 and clears it with AC', () => {
    const error = keys('14 divide 0 times 2 equals');
    expect(view(error).top).toBe('Math ERROR');
    expect(view(press(error, 'ac')).top).toBe('');
  });
});

describe('results and display formats', () => {
  it('toggles 1 ÷ 5 = 0.2 to a fraction with S⇔D', () => {
    const state = keys('1 divide 5 equals');
    expect(view(state).bottom).toBe('0.2');
    expect(view(press(state, 'sd')).bottom).toBe('1⌟5');
  });

  it('shows fraction results for fraction input', () => {
    expect(shown('1 minus 4 frac 5 equals')).toBe('1⌟5');
    expect(shown('1 minus 4 frac 5 equals sd')).toBe('0.2');
    expect(shown('2 frac 3 plus 1 frac 2 equals')).toBe('7⌟6');
    expect(shown('2 frac 3 plus 1 frac 2 equals shift sd')).toBe('1⌟1⌟6');
    expect(shown('4 minus 3 frac 1 frac 2 equals')).toBe('1⌟2');
  });

  it('shows decimals when fractions and decimals are mixed', () => {
    expect(shown('1 frac 2 plus 0 dot 5 equals')).toBe('1');
    expect(shown('1 frac 4 plus 0 dot 5 equals')).toBe('0.75');
  });

  it('calculates percentages', () => {
    expect(shown('150 times 20 shift open equals')).toBe('30');
    expect(shown('660 divide 880 shift open equals')).toBe('75');
    expect(shown('2500 plus 2500 times 15 shift open equals')).toBe('2875');
    expect(shown('3500 minus 3500 times 25 shift open equals')).toBe('2625');
  });

  it('adds sexagesimal values and converts with °\'"', () => {
    expect(shown('2 dms 20 dms 30 dms plus 0 dms 39 dms 30 dms equals')).toBe('3°0\'0"');
    const state = keys('2 dms 15 dms 18 dms equals');
    expect(view(state).bottom).toBe('2°15\'18"');
    expect(view(press(state, 'dms')).bottom).toBe('2.255');
    expect(view(press(press(state, 'dms'), 'dms')).bottom).toBe('2°15\'18"');
  });

  it('runs multi-statements one at a time with the Disp indicator', () => {
    const first = keys('3 plus 3 alpha integral 3 times 3 equals');
    expect(view(first).bottom).toBe('6');
    expect(view(first).indicators).toContain('Disp');
    const second = press(first, 'equals');
    expect(view(second).bottom).toBe('9');
    expect(view(second).indicators).not.toContain('Disp');
  });

  it('shifts engineering notation both ways', () => {
    const state = keys('1234 equals');
    expect(shown('eng', state)).toBe('1.234×10^3');
    expect(shown('eng eng', state)).toBe('1234×10^0');
    const small = keys('123 equals');
    expect(shown('shift eng', small)).toBe('0.123×10^3');
    expect(shown('shift eng shift eng', small)).toBe('0.000123×10^6');
  });

  it('uses Fix, Sci and Norm display settings', () => {
    expect(shown('shift mode 6 3 100 divide 7 equals')).toBe('14.286');
    expect(shown('shift mode 6 2 100 divide 7 equals')).toBe('14.29');
    expect(shown('shift mode 7 5 1 divide 7 equals')).toBe('1.4286×10^-1');
    expect(shown('shift mode 7 4 1 divide 7 equals')).toBe('1.429×10^-1');
    expect(shown('1 divide 200 equals')).toBe('5×10^-3');
    expect(shown('shift mode 8 2 1 divide 200 equals')).toBe('0.005');
    expect(result('shift mode 6 3').indicators).toContain('FIX');
  });

  it('rounds the internal value with Rnd( (Fix 3)', () => {
    const fix3 = keys('shift mode 6 3');
    expect(shown('10 divide 3 times 3 equals', fix3)).toBe('10.000');
    expect(shown('shift 0 10 divide 3 close times 3 equals', fix3)).toBe('9.999');
  });

  it('reformats the result shown when the setup changes', () => {
    expect(shown('100 divide 7 equals shift mode 6 2')).toBe('14.29');
  });

  it('factorizes integer results into primes', () => {
    expect(shown('1014 equals shift dms')).toBe('2×3×13²');
    // fx-991ES leaves a factor with a prime above 999 in parentheses.
    expect(shown('4104676 equals shift dms')).toBe('2²×(1026169)');
    expect(result('1 dot 5 equals shift dms').top).toBe('Math ERROR');
  });
});

describe('memory', () => {
  it('stores, uses and recalls variables', () => {
    const stored = keys('3 plus 5 shift rcl neg');
    expect(view(stored).top).toBe('3+5→A');
    expect(view(stored).bottom).toBe('8');
    expect(shown('alpha neg times 10 equals', stored)).toBe('80');
    const recalled = keys('rcl neg', stored);
    expect(view(recalled).top).toBe('A=');
    expect(view(recalled).bottom).toBe('8');
  });

  it('adds to and subtracts from independent memory', () => {
    const state = keys('0 shift rcl mplus 10 times 5 mplus 10 plus 5 shift mplus');
    expect(view(state).bottom).toBe('15');
    expect(view(state).indicators).toContain('M');
    expect(shown('rcl mplus', state)).toBe('35');
  });

  it('continues from Ans when a calculation starts with an operator', () => {
    const state = keys('3 times 4 equals divide 30 equals');
    expect(view(state).top).toBe('Ans÷30');
    expect(view(state).bottom).toBe('0.4');
    expect(shown('123 plus 456 equals 789 minus ans equals')).toBe('210');
  });

  it('repeats the last calculation with =', () => {
    expect(shown('1 equals plus 1 equals equals equals')).toBe('4');
  });

  it('keeps variables and setup through power off, but clears history', () => {
    const state = keys('shift mode 6 2 7 shift rcl tan 1 plus 1 equals shift ac on');
    expect(result('alpha tan equals', state).bottom).toBe('7.00');
    expect(result('up', state).indicators).not.toContain('▲');
    expect(view(keys('shift ac', state)).off).toBe(true);
  });

  it('clears memory through CLR', () => {
    const state = keys('7 shift rcl tan shift 9 2 equals');
    expect(view(state).top).toBe('Clear Memory');
    expect(shown('ac alpha tan equals', state)).toBe('0');
  });
});

describe('history and replay', () => {
  it('scrolls back through previous calculations', () => {
    const state = keys('1 plus 1 equals 2 plus 2 equals 3 plus 3 equals');
    expect(shown('up', state)).toBe('4');
    expect(shown('up up', state)).toBe('2');
    expect(result('up up', state).top).toBe('1+1');
  });

  it('edits the previous expression with ◀', () => {
    expect(shown('4 times 3 plus 2 equals left del del minus 7 equals')).toBe('5');
  });

  it('inserts at the cursor and overwrites in INS mode', () => {
    const state = keys('1 2 3 left left 9');
    expect(view(state).top).toBe('1923');
    const overwrite = keys('1 2 3 left left shift del 9');
    expect(view(overwrite).top).toBe('193');
    expect(view(overwrite).overwrite).toBe(true);
  });
});

describe('functions', () => {
  it('evaluates trigonometric, hyperbolic and logarithmic functions', () => {
    expect(shown('sin 30 equals')).toBe('0.5');
    expect(shown('shift sin 0 dot 5 equals')).toBe('30');
    expect(shown('hyp 1 1 equals')).toMatch(/^1\.17520119364380145688238185/);
    expect(shown('hyp 5 1 equals')).toBe('0');
    expect(shown('log 1000 equals')).toBe('3');
    expect(shown('logab 2 shift close 16 equals')).toBe('4');
    expect(shown('ln alpha exp equals')).toBe('1');
  });

  it('evaluates powers and roots', () => {
    expect(shown('1 dot 2 times 10 power 3 equals')).toBe('1200');
    expect(shown('open 5 square close shift square equals')).toBe('15625');
    expect(shown('5 shift power 32 equals')).toBe('2');
    expect(shown('shift sqrt 5 close plus shift sqrt neg 27 equals')).toMatch(/^-1\.290024053/);
    expect(shown('open 1 plus 1 close power 2 plus 2 equals')).toBe('16');
  });

  it('integrates, differentiates and sums', () => {
    expect(shown('integral ln alpha open close shift close 1 shift close alpha exp equals')).toBe('1');
    expect(shown('integral 1 divide alpha open square shift close 1 shift close 5 shift close 1 exp neg 7 equals')).toBe('0.8');
    expect(shown('shift integral 3 alpha open square minus 5 alpha open plus 2 shift close 2 equals')).toBe('7');
    expect(shown('shift logab alpha open plus 1 shift close 1 shift close 5 equals')).toBe('20');
  });

  it('differentiates sin(X) at π/2 in radians', () => {
    expect(shown('shift mode 4 shift integral sin alpha open close shift close shift exp divide 2 equals')).toBe('0');
  });

  it('converts between rectangular and polar coordinates and stores X and Y', () => {
    const polar = keys('shift plus sqrt 2 close shift close sqrt 2 equals');
    expect(view(polar).top).toBe('r=2');
    expect(view(polar).bottom).toBe('θ=45');
    expect(shown('alpha close equals', polar)).toBe('45');
    const rect = keys('shift minus sqrt 2 close shift close 45 equals');
    expect(view(rect).top).toBe('X=1');
    expect(view(rect).bottom).toBe('Y=1');
  });

  it('evaluates factorials, absolute values, permutations and combinations', () => {
    expect(shown('open 5 plus 3 close shift inv equals')).toBe('40320');
    expect(shown('shift hyp 2 minus 7 close times 2 equals')).toBe('10');
    expect(shown('10 shift times 4 equals')).toBe('5040');
    expect(shown('10 shift divide 4 equals')).toBe('210');
  });

  it('generates random numbers from the injected generator', () => {
    expect(shown('shift dot equals')).toMatch(/^0(\.\d{1,3})?$/);
    const dice = Number(view(keys('alpha dot 1 shift close 6 equals')).bottom);
    expect(dice).toBeGreaterThanOrEqual(1);
    expect(dice).toBeLessThanOrEqual(6);
  });

  it('converts angle units with DRG▶ and uses π', () => {
    expect(shown('shift mode 4 90 shift ans 1 equals')).toBe('1.57079632679489661923132169164');
    expect(shown('shift exp equals')).toBe('3.14159265358979323846264338328');
    expect(shown('shift mode 5 sin 100 equals')).toBe('1');
  });
});

describe('CALC and SOLVE', () => {
  it('substitutes values into a stored expression with CALC', () => {
    const first = keys('3 alpha neg plus alpha dms calc 5 equals 10 equals');
    expect(view(first).bottom).toBe('25');
    const second = keys('calc 7 equals 20 equals', first);
    expect(view(second).bottom).toBe('41');
  });

  it('prompts for each variable with its current value', () => {
    const prompt = keys('3 alpha neg plus alpha dms calc');
    expect(view(prompt).top).toBe('A?');
    expect(view(prompt).bottom).toBe('0');
  });

  it('solves y = ax² + b for x with SOLVE', () => {
    const state = keys('alpha close alpha calc alpha neg alpha open square plus alpha dms shift calc 0 equals 1 equals neg 2 equals 1 equals');
    const v = view(state);
    expect(v.bottomLabel).toBe('X=');
    expect(v.bottom).toBe('1.41421356237309504880168872421');
    expect(v.extra).toEqual(['L−R=0']);
  });

  it("reports Can't Solve when Newton's method finds no root", () => {
    expect(result('alpha open square plus 1 shift calc 1 equals').top).toBe("Can't Solve");
  });
});

describe('menus', () => {
  it('opens MODE, SETUP and the hyperbolic menu', () => {
    expect(result('mode').extra).toEqual(['1:COMP']);
    expect(result('shift mode').extra[0]).toContain('3:Deg');
    expect(result('shift mode down').extra[0]).toContain('1:ab/c');
    expect(result('hyp').extra[0]).toContain('1:sinh');
  });

  it('keeps the expression when a menu is cancelled', () => {
    expect(result('1 plus hyp ac').top).toBe('1+');
  });
});

// Behaviors of the fx-991ES key logic that the manual examples above don't reach.
describe('key handling details', () => {
  it('returns to COMP from MODE and clears history; LineIO keeps the screen', () => {
    const state = keys('1 plus 1 equals mode 1');
    expect(view(state).top).toBe('');
    expect(result('up', state).bottom).toBe('');
    expect(result('7 shift mode 2').top).toBe('7');
    expect(result('shift mode 9').extra[0]).toContain('3:Deg');
  });

  it('shows mixed fractions by default after choosing ab/c in SETUP', () => {
    expect(shown('shift mode down 1 7 frac 6 equals')).toBe('1⌟1⌟6');
    expect(shown('shift mode down up 3 sin 90 equals')).toBe('1');
    expect(result('shift mode down 5').extra).toEqual(['1:ab/c   2:d/c']);
  });

  it('confirms or cancels CLR, and resets the setup', () => {
    const confirm = keys('shift 9 1');
    expect(view(confirm).top).toBe('Reset Setup?');
    expect(view(confirm).extra).toEqual(['[=] :Yes', '[AC]:Cancel']);
    expect(view(keys('5', confirm)).top).toBe('Reset Setup?');
    expect(view(keys('ac', confirm)).top).toBe('');
    const reset = keys('shift mode 4 shift 9 1 equals');
    expect(view(reset).top).toBe('Reset Setup');
    expect(view(keys('7', reset)).top).toBe('Reset Setup');
    expect(result('ac', reset).indicators).toContain('D');
    expect(result('shift 9 3 equals').top).toBe('Reset All');
  });

  it('ignores invalid menu choices', () => {
    expect(result('shift ans 7').extra).toEqual(['1:°   2:ʳ   3:ᵍ']);
    expect(result('mode 5').extra).toEqual(['1:COMP']);
    expect(result('shift mode 6 dot').extra).toEqual(['Fix 0~9?']);
    expect(result('shift mode 8 3').extra).toEqual(['Norm 1~2?']);
    expect(result('shift 9 7').extra).toContain('3:All');
  });

  it('uses Sci 0 for the full width and Rnd( in Sci and Norm', () => {
    expect(shown('shift mode 7 0 1 divide 8 equals')).toBe('1.25000000000000000000000000000×10^-1');
    expect(shown('shift mode 7 2 shift 0 1 divide 3 close times 3 equals')).toBe('9.9×10^-1');
    expect(shown('shift 0 1 divide 3 close times 3 equals')).toBe('0.' + '9'.repeat(30)); // Rnd keeps 30 digits
  });

  it('handles CALC and SOLVE edge cases', () => {
    expect(view(keys('calc')).top).toBe('');
    expect(shown('2 plus 3 calc')).toBe('5');
    expect(result('2 plus 3 shift calc').top).toBe('Syntax ERROR');
    expect(result('alpha neg plus calc').top).toBe('Syntax ERROR');
    const prompt = keys('alpha neg times 2 calc 3 del 4 equals');
    expect(view(prompt).bottom).toBe('8');
    expect(result('alpha neg calc 2 plus equals').top).toBe('Syntax ERROR');
    expect(shown('alpha close alpha calc alpha neg plus 1 calc 4 equals')).toBe('5');
    expect(result('rcl close').bottom).toBe('0');
    expect(shown('alpha close alpha calc alpha neg plus 1 calc 4 equals rcl close')).toBe('5');
    expect(shown('alpha neg alpha calc 1 calc')).toBe('1');
    expect(result('2 alpha calc 1 calc').top).toBe('Syntax ERROR');
    const solved = keys('alpha open minus 2 shift calc 1 equals');
    expect(view(solved).bottom).toBe('2');
    expect(view(keys('equals', solved)).top).toBe('X?');
    expect(view(keys('ac', keys('alpha neg calc'))).top).toBe('');
  });

  it('stops M+ and STO at an error in the expression', () => {
    expect(result('1 divide 0 mplus').top).toBe('Math ERROR');
    expect(result('1 divide 0 shift rcl neg').top).toBe('Math ERROR');
    expect(result('1 shift integral 9 9 plus open 1 divide 0 close shift close 1 equals').top).toBe('Math ERROR');
    expect(shown('neg 5 shift rcl neg')).toBe('-5');
  });

  it('stores Ans with STO from an empty line and adds Ans to memory from a result', () => {
    expect(result('2 plus 2 equals ac shift rcl neg').top).toBe('Ans→A');
    const memory = keys('6 equals mplus');
    expect(view(memory).top).toBe('AnsM+');
    expect(shown('rcl mplus', memory)).toBe('6');
  });

  it('edits with AC, DEL, cursor jumps, and the 99-token limit', () => {
    expect(view(keys('1 2 ac')).top).toBe('');
    expect(view(keys('1 2 left left del')).top).toBe('12');
    expect(view(keys('1 2 up')).cursor).toBe(0);
    expect(view(keys('1 2 up down')).cursor).toBe(2);
    expect(view(keys(`${'1'.repeat(120)}`)).top).toBe('1'.repeat(99));
    expect(view(keys(`${'1'.repeat(99)} left shift del 2`)).top).toBe(`${'1'.repeat(98)}2`);
    expect(view(keys('5 equals del')).top).toBe('');
    expect(view(keys('5 plus 6 equals right')).cursor).toBe(0);
    expect(view(keys('rcl neg left')).top).toBe('');
  });

  it('evaluates with S⇔D directly from the input line', () => {
    expect(shown('1 divide 4 sd')).toBe('1⌟4');
    expect(result('1 divide 0 sd').top).toBe('Math ERROR');
    expect(shown('sqrt 2 equals sd')).toBe('1.41421356237309504880168872421');
    expect(shown('2 equals shift sd')).toBe('2');
    expect(shown('1 frac 3 equals shift sd')).toBe('1⌟3');
  });

  it('ignores keys that do nothing in the current state', () => {
    expect(view(keys('1 plus 2 equals eng ac eng')).top).toBe('');
    expect(view(keys('1 divide 0 equals 5')).top).toBe('Math ERROR');
    expect(view(keys('shift 5')).top).toBe('');
    expect(view(keys('alpha 5')).indicators).not.toContain('A');
    expect(view(keys('shift shift')).indicators).not.toContain('S');
    expect(view(keys('rcl 5')).indicators).not.toContain('RCL');
    expect(view(keys('5 shift sd')).top).toBe('5');
    expect(view(keys('on 5 on')).top).toBe('');
    expect(view(keys('shift ac 5')).off).toBe(true);
  });

  it('formats large paired results and history arrows', () => {
    const big = keys('shift minus 1 exp 40 shift close 0 equals');
    expect(view(big).top).toBe('X=1×10⁴⁰');
    const history = keys('1 equals 2 equals up');
    expect(view(history).indicators).toContain('▼');
    expect(view(keys('down', history)).bottom).toBe('2');
    expect(view(keys('down down', history)).bottom).toBe('2');
  });
});

describe('expression details', () => {
  it('evaluates x⁻¹, Ans, π and e with implied multiplication', () => {
    expect(shown('4 inv equals')).toBe('0.25');
    expect(shown('6 equals 2 ans equals')).toBe('12');
    expect(shown('2 shift exp equals')).toBe('6.28318530717958647692528676656');
    expect(shown('2 alpha exp alpha neg equals')).toBe('0');
    expect(shown('3 alpha open alpha close alpha mplus equals')).toBe('0');
  });

  it('reads sexagesimal input with degrees only or degrees and minutes', () => {
    expect(shown('1 dms 30 dms equals')).toBe('1°30\'0"');
    expect(shown('1 dms 30 dms equals dms')).toBe('1.5');
    expect(shown('2 dms equals')).toBe('2°0\'0"');
    expect(result('1 dms 30 equals').top).toBe('Syntax ERROR');
  });

  it('accepts a closing parenthesis omitted before a colon', () => {
    expect(shown('sqrt 4 alpha integral 2 equals')).toBe('2');
  });

  it('rejects malformed numbers and trailing input', () => {
    expect(result('dot equals').top).toBe('Syntax ERROR');
    expect(result('2 exp equals').top).toBe('Syntax ERROR');
    expect(result('2 exp neg equals').top).toBe('Syntax ERROR');
    expect(shown('exp 3 equals')).toBe('1000');
    expect(shown('2 exp minus 2 equals')).toBe('0.02');
    expect(result('2 close equals').top).toBe('Syntax ERROR');
    expect(result('2 alpha calc 3 equals').top).toBe('Syntax ERROR');
    expect(result('sin equals').top).toBe('Syntax ERROR');
    expect(result('logab 2 shift close 3 shift close 4 equals').top).toBe('Syntax ERROR');
  });

  it('validates function arguments', () => {
    expect(result('logab 1 shift close 5 equals').top).toBe('Math ERROR');
    expect(result('alpha dot 6 shift close 1 equals').top).toBe('Math ERROR');
    expect(result('alpha dot 1 dot 5 shift close 6 equals').top).toBe('Math ERROR');
    expect(result('alpha dot 1 shift close 6 dot 5 equals').top).toBe('Math ERROR');
    expect(result('shift logab alpha open shift close 5 shift close 1 equals').top).toBe('Math ERROR');
    expect(result('shift logab alpha open shift close 1 dot 5 shift close 3 equals').top).toBe('Math ERROR');
    expect(result('shift logab alpha open shift close 1 shift close 2 dot 5 equals').top).toBe('Math ERROR');
    expect(result('shift logab alpha open shift close 1 shift close 200001 equals').top).toBe('Math ERROR');
    expect(shown('shift logab 1 shift close 1 shift close 100000 equals')).toBe('100000');
    expect(result('1 plus shift plus 1 shift close 1 close equals').top).toBe('Syntax ERROR');
    expect(result('integral 1 divide alpha open shift close 0 shift close 1 equals').top).toBe('Math ERROR');
  });

  it('scales Ran# and RanInt# from the generator', () => {
    const at = (seed: number, sequence: string) => view(keys(sequence, initialCasio, seed)).bottom;
    expect(at(0, 'shift dot equals')).toBe(at(0, 'shift dot equals'));
    const values = new Set([0.1, 0.3, 0.6, 0.9].map(seed => at(seed, 'alpha dot 1 shift close 3 equals')));
    expect([...values].every(v => ['1', '2', '3'].includes(v))).toBe(true);
    expect(values.size).toBeGreaterThan(1);
    const randoms = [0.1, 0.5, 0.9].map(seed => Number(at(seed, 'shift dot times 1000 equals')));
    expect(randoms.every(r => Number.isInteger(r) && r >= 0 && r < 1000)).toBe(true);
    expect(new Set(randoms).size).toBeGreaterThan(1);
  });

  it('stores Rec( results in X and Y', () => {
    expect(shown('shift minus 2 shift close 90 equals alpha close equals')).toBe('2');
    expect(shown('shift minus 2 shift close 90 equals alpha open equals')).toBe('0');
  });

  it('solves equations whose derivative vanishes at the start value', () => {
    expect(shown('alpha open square minus 4 shift calc 0 equals')).toMatch(/^-?2$/);
    expect(shown('alpha open minus 3 alpha calc 0 shift calc 3 equals')).toBe('3');
  });

  it('lists variables once in order of first appearance', () => {
    const prompts = keys('alpha dms plus alpha neg plus alpha dms calc');
    expect(view(prompts).top).toBe('B?');
    expect(view(keys('1 equals', prompts)).top).toBe('A?');
    expect(view(keys('1 equals 2 equals', prompts)).bottom).toBe('4');
  });
});
