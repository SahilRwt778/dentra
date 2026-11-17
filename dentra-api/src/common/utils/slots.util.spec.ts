import { slotHasPassed } from './slots.util';

describe('slotHasPassed uses India appointment time on every server', () => {
  const now = new Date('2026-11-17T10:00:00+05:30');
  test.each([
    ['2026-11-16', '23:50', true],
    ['2026-11-17', '09:50', true],
    ['2026-11-17', '10:00', true],
    ['2026-11-17', '10:10', false],
    ['2026-11-18', '00:00', false],
  ])('%s %s has passed: %s', (date, time, expected) => {
    expect(slotHasPassed(date, time, now)).toBe(expected);
  });
  test('handles the India midnight boundary while the UTC date is still yesterday', () => {
    expect(
      slotHasPassed(
        '2026-11-18',
        '00:00',
        new Date('2026-11-17T18:29:59.999Z'),
      ),
    ).toBe(false);
    expect(
      slotHasPassed(
        '2026-11-18',
        '00:00',
        new Date('2026-11-17T18:30:00.000Z'),
      ),
    ).toBe(true);
  });
});
