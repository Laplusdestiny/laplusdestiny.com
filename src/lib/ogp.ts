/**
 * URL から OGP（Open Graph）情報を取り出す。ビルド時に実行される。
 * 取得に失敗してもビルドは止めず、undefined を返す。
 */

export interface OgpData {
  /** リダイレクト後の最終 URL */
  url: string;
  title?: string;
  description?: string;
  /** 絶対 URL に解決済みの画像 URL */
  image?: string;
  siteName?: string;
}

export type Fetcher = typeof fetch;

const USER_AGENT = 'Mozilla/5.0 (compatible; portfolio-ogp-fetcher/1.0)';
const TIMEOUT_MS = 10_000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([^\s"'=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  for (const m of tag.matchAll(pattern)) {
    const name = m[1].toLowerCase();
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** http(s) の絶対 URL に解決する。それ以外（javascript: など）は捨てる。 */
export function resolveHttpUrl(value: string, base: string): string | undefined {
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function parseOgp(html: string, baseUrl: string): Omit<OgpData, 'url'> {
  const head = html.split(/<\/head>/i)[0];
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attrs = parseAttributes(m[0]);
    const key = (attrs.property ?? attrs.name)?.toLowerCase();
    const content = attrs.content?.trim();
    // 同じキーが複数ある場合は最初のものを使う（og:image が複数並ぶサイト向け）
    if (key && content && !(key in meta)) meta[key] = content;
  }

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const image = meta['og:image'] ?? meta['og:image:url'] ?? meta['twitter:image'];

  return {
    title:
      meta['og:title'] ??
      meta['twitter:title'] ??
      (titleTag ? decodeEntities(titleTag).trim() || undefined : undefined),
    description: meta['og:description'] ?? meta['twitter:description'] ?? meta['description'],
    image: image ? resolveHttpUrl(image, baseUrl) : undefined,
    siteName: meta['og:site_name'],
  };
}

export async function fetchOgp(url: string, fetcher: Fetcher = fetch): Promise<OgpData | undefined> {
  try {
    const res = await fetcher(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[ogp] ${url}: HTTP ${res.status}`);
      return undefined;
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      console.warn(`[ogp] ${url}: HTML ではありません (${contentType})`);
      return undefined;
    }
    const finalUrl = res.url || url;
    return { url: finalUrl, ...parseOgp(await res.text(), finalUrl) };
  } catch (error) {
    console.warn(`[ogp] ${url}: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}
