const test = require('node:test');
const assert = require('node:assert');
const { generateSlots, windowsOverlap, isValidDate, weekdayOf } = require('../src/utils/slots');

test('generates 30-minute slots across a window', () => {
  const s = generateSlots([{ start_time: '09:00:00', end_time: '11:00:00', slot_minutes: 30 }]);
  assert.deepStrictEqual(s.map(x => x.time), ['09:00', '09:30', '10:00', '10:30']);
});
test('marks booked slots unavailable', () => {
  const s = generateSlots([{ start_time: '09:00', end_time: '10:00', slot_minutes: 30 }], ['09:30:00']);
  assert.strictEqual(s.find(x => x.time === '09:30').available, false);
  assert.strictEqual(s.find(x => x.time === '09:00').available, true);
});
test('does not create a slot that overruns the window', () => {
  assert.strictEqual(generateSlots([{ start_time: '09:00', end_time: '09:50', slot_minutes: 30 }]).length, 1);
});
test('skips slots that overlap a break', () => {
  const s = generateSlots([{ start_time: '09:00', end_time: '12:00', slot_minutes: 30, break_start: '10:00:00', break_end: '10:30:00' }]);
  assert.deepStrictEqual(s.map(x => x.time), ['09:00', '09:30', '10:30', '11:00', '11:30']);
});
test('supports 20-minute slots', () => {
  const s = generateSlots([{ start_time: '09:00', end_time: '10:00', slot_minutes: 20 }]);
  assert.deepStrictEqual(s.map(x => x.time), ['09:00', '09:20', '09:40']);
});
test('detects overlapping working windows on the same day only', () => {
  assert.ok(windowsOverlap([{ weekday: 1, start_time: '09:00', end_time: '12:00' }, { weekday: 1, start_time: '11:00', end_time: '13:00' }]));
  assert.ok(!windowsOverlap([{ weekday: 1, start_time: '09:00', end_time: '12:00' }, { weekday: 2, start_time: '11:00', end_time: '13:00' }]));
  assert.ok(!windowsOverlap([{ weekday: 1, start_time: '09:00', end_time: '12:00' }, { weekday: 1, start_time: '14:00', end_time: '18:00' }]));
});
test('validates dates and weekday', () => {
  assert.ok(isValidDate('2026-10-25'));
  assert.ok(!isValidDate('25-10-2026'));
  assert.strictEqual(weekdayOf('2026-10-25'), 0);
});
