function toMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function toTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function generateSlots(windows, booked = []) {
  const taken = new Set(booked.map(b => b.slice(0, 5)));
  const slots = [];
  for (const w of windows) {
    const step = w.slot_minutes || 30;
    const bs = w.break_start ? toMinutes(w.break_start) : null;
    const be = w.break_end ? toMinutes(w.break_end) : null;
    for (let t = toMinutes(w.start_time); t + step <= toMinutes(w.end_time); t += step) {
      if (bs !== null && be !== null && t < be && t + step > bs) continue;
      const time = toTime(t);
      slots.push({ time, available: !taken.has(time) });
    }
  }
  return slots;
}

function windowsOverlap(windows) {
  const byDay = {};
  for (const w of windows) (byDay[w.weekday] ||= []).push([toMinutes(w.start_time), toMinutes(w.end_time)]);
  return Object.values(byDay).some(list => {
    list.sort((a, b) => a[0] - b[0]);
    return list.some((cur, i) => i > 0 && cur[0] < list[i - 1][1]);
  });
}

function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z')); }
function weekdayOf(dateStr) { return new Date(dateStr + 'T00:00:00Z').getUTCDay(); }

module.exports = { generateSlots, windowsOverlap, toMinutes, toTime, isValidDate, weekdayOf };
