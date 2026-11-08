/** Display helpers shared by the admin dashboard. */

const numberFormat = new Intl.NumberFormat('uk-UA');
let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(['uk'], { type: 'region' });
} catch {
  regionNames = null;
}

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return digits > 0 ? n.toLocaleString('uk-UA', { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : numberFormat.format(Math.round(n));
}

export function pct(part: number, total: number): string {
  if (!total || !part) return '0%';
  const value = (part / total) * 100;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}

export function duration(seconds: number): string {
  if (!seconds || seconds < 1) return '0 с';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)} год ${m % 60} хв`;
  return m > 0 ? `${m} хв ${s} с` : `${s} с`;
}

/** Change vs previous period. `lowerIsBetter` flips the colour (e.g. bounce rate). */
export function delta(current: number, previous: number, lowerIsBetter = false): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (!previous && !current) return { text: '—', tone: 'flat' };
  if (!previous) return { text: 'нове', tone: lowerIsBetter ? 'down' : 'up' };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return { text: '0%', tone: 'flat' };
  const good = lowerIsBetter ? change < 0 : change > 0;
  return { text: `${change > 0 ? '+' : ''}${Math.round(change)}%`, tone: good ? 'up' : 'down' };
}

export function flag(code: string): string {
  if (!code || code.length !== 2 || code === 'XX') return '🏳️';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryName(code: string): string {
  if (!code || code === 'XX') return 'Невідомо';
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

const PAGE_NAMES: Record<string, string> = {
  home: 'Головна',
  swipe: 'Свайп',
  leaderboard: 'Рейтинг / Краш дня',
  teacher: 'Профіль викладача',
  admin: 'Адмінка',
  other: 'Інше',
};

const DEVICE_NAMES: Record<string, string> = {
  mobile: 'Телефон',
  tablet: 'Планшет',
  desktop: "Комп'ютер",
  unknown: 'Невідомо',
};

export function pageName(key: string): string { return PAGE_NAMES[key] ?? key; }
export function deviceName(key: string): string { return DEVICE_NAMES[key] ?? key; }

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}`;
}
