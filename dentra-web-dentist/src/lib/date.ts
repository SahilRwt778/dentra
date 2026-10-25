// Ported from ../../../index.html's `U` object — same approach to a
// subtlety that matters here: parsing a "YYYY-MM-DD" string with
// `new Date(y, m-1, d)` (the local-timezone constructor) rather than
// `new Date(isoString)` (which parses as UTC midnight and can then
// display as the previous day once converted to local time). Appointment
// dates are plain calendar dates, not timestamps, so none of these
// should ever go through the ISO-string Date constructor.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function todayIso(): string {
  return addDaysIso(0);
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = parseIso(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}

export function dayLabel(iso: string): string {
  if (iso === todayIso()) return 'Today';
  if (iso === addDaysIso(1)) return 'Tomorrow';
  const d = parseIso(iso);
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
}

export function formatTime(t: string | undefined | null): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = Number(hStr);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr.padStart(2, '0')} ${ap}`;
}

export function rupees(amountPaise: number | undefined | null): string {
  return `₹${Number((amountPaise ?? 0) / 100).toLocaleString('en-IN')}`;
}

export function initials(name: string | undefined | null): string {
  return (name ?? '')
    .replace(/^Dr\.\s*/, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function age(dob: string | undefined | null): number | null {
  if (!dob) return null;
  const b = parseIso(dob);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}

export function slotHasPassed(iso: string, time: string): boolean {
  const today = todayIso();
  if (iso < today) return true;
  if (iso > today) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m <= nowMinutes;
}
