const TIME_ZONE = 'Asia/Tokyo';

const isoDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 日本時間の YYYY-MM-DD */
export function formatDate(date: Date): string {
  return isoDate.format(date);
}

/** 日本時間での年と四半期（1〜4） */
export function quarterOf(date: Date): { year: number; quarter: number } {
  const [year, month] = formatDate(date).split('-').map(Number);
  return { year, quarter: Math.floor((month - 1) / 3) + 1 };
}

/** 1,234 / 12.3 KB のようにバイト数を読みやすくする */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}

/** 0.623 → 62% （1% 未満は「<1%」） */
export function formatShare(share: number): string {
  if (share > 0 && share < 0.01) return '<1%';
  return `${Math.round(share * 100)}%`;
}

/**
 * 0 から max までを覆う、きりのいい目盛りを返す（棒グラフの縦軸用）。
 * 例: max=3 → [0,1,2,3], max=7 → [0,2,4,6,8]
 */
export function niceTicks(max: number, maxTicks = 5): number[] {
  if (max <= 0) return [0, 1];
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const step = steps.find((s) => Math.ceil(max / s) <= maxTicks - 1) ?? steps[steps.length - 1];
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

/** https://example.com/app/ → example.com/app */
export function displayUrl(url: string): string {
  const { host, pathname } = new URL(url);
  return `${host.replace(/^www\./, '')}${pathname}`.replace(/\/$/, '');
}
