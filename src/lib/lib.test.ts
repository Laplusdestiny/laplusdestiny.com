import { describe, expect, it, vi } from 'vitest';
import { decodeEntities, fetchOgp, parseOgp, resolveHttpUrl } from './ogp';
import { normalizeHomepage, parseGitHubRepoUrl } from './github';
import { aggregateLanguages, loadWork, type Work } from './works';
import { countByQuarter, fetchPosts, parseFeed, type Post } from './blog';
import { displayUrl, formatBytes, formatDate, formatShare, niceTicks, quarterOf } from './format';

describe('decodeEntities', () => {
  it('名前付き・数値の文字参照を戻す', () => {
    expect(decodeEntities('A &amp; B &lt;3 &#39;x&#x27; &quot;q&quot;')).toBe(`A & B <3 'x' "q"`);
  });
  it('知らない参照はそのまま残す', () => {
    expect(decodeEntities('&unknown; &#xZZ;')).toBe('&unknown; &#xZZ;');
  });
});

describe('parseOgp', () => {
  const html = `<!doctype html><html><head>
    <title>Fallback &amp; Title</title>
    <meta content="説明 &gt; です" property="og:description">
    <meta property='og:title' content='OG タイトル'>
    <meta property="og:image" content="/img/card.png">
    <meta property="og:image" content="https://example.com/second.png">
    <meta name="description" content="普通の説明">
    <meta property="og:site_name" content="Example">
  </head><body><meta property="og:title" content="body は無視"></body></html>`;

  it('属性の順番や引用符に関係なく OGP を読む', () => {
    expect(parseOgp(html, 'https://example.com/page')).toEqual({
      title: 'OG タイトル',
      description: '説明 > です',
      image: 'https://example.com/img/card.png',
      siteName: 'Example',
    });
  });

  it('OGP がなければ title タグと description を使う', () => {
    const plain = '<head><title> Plain &amp; Simple </title><meta name="description" content="desc"></head>';
    expect(parseOgp(plain, 'https://example.com')).toEqual({
      title: 'Plain & Simple',
      description: 'desc',
      image: undefined,
      siteName: undefined,
    });
  });

  it('属性値に > を含んでいても壊れない', () => {
    const tricky = '<head><meta property="og:title" content="a > b"></head>';
    expect(parseOgp(tricky, 'https://example.com').title).toBe('a > b');
  });
});

describe('resolveHttpUrl', () => {
  it('相対 URL を解決し、http(s) 以外は捨てる', () => {
    expect(resolveHttpUrl('/a.png', 'https://example.com/x/y')).toBe('https://example.com/a.png');
    expect(resolveHttpUrl('javascript:alert(1)', 'https://example.com')).toBeUndefined();
  });
});

describe('fetchOgp', () => {
  it('失敗しても例外を投げず undefined を返す', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(fetchOgp('https://example.com', failing)).resolves.toBeUndefined();
    const notFound = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));
    await expect(fetchOgp('https://example.com', notFound)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe('parseGitHubRepoUrl', () => {
  it('リポジトリ URL から owner と repo を取り出す', () => {
    expect(parseGitHubRepoUrl('https://github.com/Laplusdestiny/setlistic')).toEqual({ owner: 'Laplusdestiny', repo: 'setlistic' });
    expect(parseGitHubRepoUrl('https://github.com/a/b.git/tree/main')).toEqual({ owner: 'a', repo: 'b' });
  });
  it('GitHub 以外やユーザーページは対象外', () => {
    expect(parseGitHubRepoUrl('https://example.com/a/b')).toBeUndefined();
    expect(parseGitHubRepoUrl('https://github.com/Laplusdestiny')).toBeUndefined();
    expect(parseGitHubRepoUrl('not a url')).toBeUndefined();
  });
});

describe('normalizeHomepage', () => {
  it('空はなし、スキームなしは https を補う、危険なスキームは捨てる', () => {
    expect(normalizeHomepage('')).toBeUndefined();
    expect(normalizeHomepage(null)).toBeUndefined();
    expect(normalizeHomepage('example.com/app')).toBe('https://example.com/app');
    expect(normalizeHomepage('https://setlistic.laplusdestiny.com')).toBe('https://setlistic.laplusdestiny.com/');
    expect(normalizeHomepage('javascript:alert(1)')).toBeUndefined();
  });
});

describe('loadWork', () => {
  it('GitHub のリポジトリは API の名前と説明を使い、画像は OGP から取る', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === 'https://api.github.com/repos/o/r') {
        return Response.json({
          name: 'r', owner: { login: 'o' }, description: 'API の説明', language: 'Python',
          stargazers_count: 2, pushed_at: '2026-11-01T00:00:00Z', homepage: '', archived: false,
        });
      }
      if (url === 'https://api.github.com/repos/o/r/languages') return Response.json({ Python: 100 });
      return new Response('<head><meta property="og:title" content="GitHub - o/r: 長い"><meta property="og:image" content="https://img.example/r.png"></head>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    });
    const work = await loadWork({ url: 'https://github.com/o/r' }, { fetcher: fetcher as typeof fetch });
    expect(work).toMatchObject({ title: 'r', description: 'API の説明', image: 'https://img.example/r.png' });
    expect(work.repo).toMatchObject({ language: 'Python', stars: 2, homepage: undefined, languages: { Python: 100 } });
  });

  it('works.json の値は取得した値より優先する', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    const work = await loadWork({ url: 'https://example.com', title: '手書き', description: '説明' }, { fetcher });
    expect(work).toEqual({ url: 'https://example.com', title: '手書き', description: '説明', image: undefined, repo: undefined });
    warn.mockRestore();
  });
});

describe('aggregateLanguages', () => {
  const work = (languages: Record<string, number>): Work => ({
    url: 'x', title: 'x',
    repo: { owner: 'o', name: 'n', stars: 0, archived: false, languages },
  });

  it('言語ごとに合計して多い順に並べる', () => {
    const rows = aggregateLanguages([work({ Python: 300, CSS: 100 }), work({ Python: 100, TypeScript: 500 })]);
    expect(rows.map((r) => [r.name, r.bytes])).toEqual([['TypeScript', 500], ['Python', 400], ['CSS', 100]]);
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1);
  });

  it('上限を超えた分は「その他」にまとめる', () => {
    const rows = aggregateLanguages([work({ A: 50, B: 40, C: 30, D: 20, E: 10 })], 3);
    expect(rows.map((r) => [r.name, r.bytes])).toEqual([['A', 50], ['B', 40], ['その他', 60]]);
  });

  it('言語情報がなければ空', () => {
    expect(aggregateLanguages([{ url: 'x', title: 'x' }])).toEqual([]);
  });
});

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Blog</title>
  <item><title>古い記事</title><link>https://blog.example/posts/old</link><pubDate>Sun, 22 Sep 2024 00:00:00 GMT</pubDate><category>introduction</category></item>
  <item><title><![CDATA[新しい & 記事]]></title><link>/posts/new</link><pubDate>Mon, 10 Nov 2025 03:00:00 GMT</pubDate>
    <description><![CDATA[<p>本文の<b>要約</b></p>]]></description><category>gadget</category><category>review</category></item>
  <item><title>日付なし</title><link>https://blog.example/posts/nodate</link></item>
</channel></rss>`;

describe('parseFeed', () => {
  it('RSS 2.0 を新しい順に読み、壊れた項目は捨てる', () => {
    const posts = parseFeed(rss, 'https://blog.example/feed.xml');
    expect(posts.map((p) => p.title)).toEqual(['新しい & 記事', '古い記事']);
    expect(posts[0]).toMatchObject({
      url: 'https://blog.example/posts/new',
      description: '本文の 要約',
      tags: ['gadget', 'review'],
    });
    expect(posts[1].tags).toEqual(['introduction']);
  });

  it('Atom も読める', () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><title type="html">Atom 記事</title><link rel="alternate" href="https://a.example/1"/>
      <published>2026-01-05T00:00:00Z</published><summary>まとめ</summary><category term="tech"/></entry></feed>`;
    expect(parseFeed(atom, 'https://a.example/feed')).toEqual([
      { title: 'Atom 記事', url: 'https://a.example/1', date: new Date('2026-01-05T00:00:00Z'), description: 'まとめ', tags: ['tech'] },
    ]);
  });
});

describe('fetchPosts', () => {
  it('HTML が返ってきたら（フィード未設置）空配列', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetcher = vi.fn().mockResolvedValue(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }));
    await expect(fetchPosts('https://blog.example/feed.xml', fetcher)).resolves.toEqual([]);
    warn.mockRestore();
  });
});

describe('countByQuarter', () => {
  const post = (iso: string): Post => ({ title: 't', url: 'u', date: new Date(iso), tags: [] });

  it('最初の投稿から現在まで、空の四半期も 0 で埋める', () => {
    const posts = [post('2025-01-15T00:00:00+09:00'), post('2025-02-01T00:00:00+09:00'), post('2025-07-01T00:00:00+09:00')];
    expect(countByQuarter(posts, new Date('2025-11-22T00:00:00+09:00'))).toEqual([
      { year: 2025, quarter: 1, count: 2 },
      { year: 2025, quarter: 2, count: 0 },
      { year: 2025, quarter: 3, count: 1 },
      { year: 2025, quarter: 4, count: 0 },
    ]);
  });

  it('年をまたぐ', () => {
    const result = countByQuarter([post('2024-12-31T12:00:00+09:00')], new Date('2025-01-02T00:00:00+09:00'));
    expect(result.map((q) => `${q.year}Q${q.quarter}:${q.count}`)).toEqual(['2024Q4:1', '2025Q1:0']);
  });

  it('投稿がなければ空', () => {
    expect(countByQuarter([], new Date())).toEqual([]);
  });
});

describe('format', () => {
  it('日付は日本時間で数える', () => {
    // UTC では 12/31 だが日本時間では 1/1
    const d = new Date('2025-12-31T16:00:00Z');
    expect(formatDate(d)).toBe('2026-01-01');
    expect(quarterOf(d)).toEqual({ year: 2026, quarter: 1 });
  });

  it('バイト数と割合', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatShare(0.623)).toBe('62%');
    expect(formatShare(0.004)).toBe('<1%');
  });

  it('URL を短く表示する', () => {
    expect(displayUrl('https://www.example.com/app/')).toBe('example.com/app');
    expect(displayUrl('https://setlistic.laplusdestiny.com/')).toBe('setlistic.laplusdestiny.com');
  });

  it('目盛りはきりのいい数', () => {
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
