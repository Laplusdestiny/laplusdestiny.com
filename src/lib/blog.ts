/**
 * ブログの RSS / Atom フィードを読み、記事一覧と四半期ごとの投稿数を作る。
 * フィードが取れないときは空配列を返し、ブログ欄ごと非表示にする。
 */
import { XMLParser } from 'fast-xml-parser';
import type { Fetcher } from './ogp';
import { resolveHttpUrl } from './ogp';
import { quarterOf } from './format';

export interface Post {
  title: string;
  url: string;
  date: Date;
  description?: string;
  tags: string[];
}

const TIMEOUT_MS = 10_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['item', 'entry', 'category', 'link'].includes(name),
});

/** fast-xml-parser の値（文字列 / {#text} / 配列）を文字列にする */
function text(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') return text((value as Record<string, unknown>)['#text']);
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain === '' ? undefined : plain;
}

function toPost(raw: { title?: string; url?: string; date?: string; description?: string; tags: string[] }, base: string): Post | undefined {
  const url = raw.url ? resolveHttpUrl(raw.url, base) : undefined;
  const date = raw.date ? new Date(raw.date) : undefined;
  if (!raw.title || !url || !date || Number.isNaN(date.getTime())) return undefined;
  return { title: raw.title, url, date, description: stripHtml(raw.description), tags: raw.tags };
}

/** RSS 2.0 と Atom の両方に対応。新しい順に並べて返す */
export function parseFeed(xml: string, feedUrl: string): Post[] {
  const doc = parser.parse(xml) as Record<string, any>;
  let posts: (Post | undefined)[] = [];

  if (doc.rss?.channel) {
    const items: any[] = doc.rss.channel.item ?? [];
    posts = items.map((item) =>
      toPost(
        {
          title: text(item.title),
          url: text(item.link),
          date: text(item.pubDate) ?? text(item['dc:date']),
          description: text(item.description),
          tags: (item.category ?? []).map(text).filter(Boolean),
        },
        feedUrl,
      ),
    );
  } else if (doc.feed) {
    const entries: any[] = doc.feed.entry ?? [];
    posts = entries.map((entry) => {
      const links: any[] = entry.link ?? [];
      const link = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
      return toPost(
        {
          title: text(entry.title),
          url: link?.['@_href'],
          date: text(entry.published) ?? text(entry.updated),
          description: text(entry.summary) ?? text(entry.content),
          tags: (entry.category ?? []).map((c: any) => c?.['@_term']).filter(Boolean),
        },
        feedUrl,
      );
    });
  }

  return posts.filter((p): p is Post => p !== undefined).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function fetchPosts(feedUrl: string, fetcher: Fetcher = fetch): Promise<Post[]> {
  try {
    const res = await fetcher(feedUrl, {
      headers: { accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[blog] ${feedUrl}: HTTP ${res.status}`);
      return [];
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('html')) {
      console.warn(`[blog] ${feedUrl}: フィードではなく HTML が返りました`);
      return [];
    }
    return parseFeed(await res.text(), res.url || feedUrl);
  } catch (error) {
    console.warn(`[blog] ${feedUrl}: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

export interface QuarterCount {
  year: number;
  quarter: number;
  count: number;
}

/** 最初の投稿の四半期から now の四半期まで、投稿がない期も 0 として埋めて返す */
export function countByQuarter(posts: Post[], now: Date): QuarterCount[] {
  if (posts.length === 0) return [];
  const counts = new Map<string, number>();
  let first = quarterOf(now);
  for (const post of posts) {
    const q = quarterOf(post.date);
    counts.set(`${q.year}-${q.quarter}`, (counts.get(`${q.year}-${q.quarter}`) ?? 0) + 1);
    if (q.year < first.year || (q.year === first.year && q.quarter < first.quarter)) first = q;
  }

  const last = quarterOf(now);
  const result: QuarterCount[] = [];
  for (let { year, quarter } = first; year < last.year || (year === last.year && quarter <= last.quarter); ) {
    result.push({ year, quarter, count: counts.get(`${year}-${quarter}`) ?? 0 });
    quarter += 1;
    if (quarter > 4) {
      quarter = 1;
      year += 1;
    }
  }
  return result;
}
