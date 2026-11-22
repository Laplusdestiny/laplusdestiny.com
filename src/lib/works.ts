/**
 * src/data/works.json に並べた URL から、作品カードに必要な情報を組み立てる。
 * GitHub のリポジトリは API の情報を優先し、それ以外のサイトは OGP を使う。
 */
import { fetchOgp, type Fetcher } from './ogp';
import { fetchRepo, parseGitHubRepoUrl, type RepoInfo } from './github';

/** works.json の 1 件。url 以外は OGP や GitHub の値を上書きしたいときだけ書く */
export interface WorkEntry {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface Work {
  url: string;
  title: string;
  description?: string;
  /** OGP 画像の URL（最適化前） */
  image?: string;
  repo?: RepoInfo;
}

export interface LoadWorksOptions {
  githubToken?: string;
  fetcher?: Fetcher;
}

export async function loadWork(entry: WorkEntry, options: LoadWorksOptions = {}): Promise<Work> {
  const gh = parseGitHubRepoUrl(entry.url);
  const [ogp, repo] = await Promise.all([
    fetchOgp(entry.url, options.fetcher),
    gh ? fetchRepo(gh.owner, gh.repo, { token: options.githubToken, fetcher: options.fetcher }) : undefined,
  ]);

  return {
    url: entry.url,
    // GitHub の og:title は「GitHub - owner/repo: 説明」と長いので、リポジトリ名を使う
    title: entry.title ?? repo?.name ?? gh?.repo ?? ogp?.title ?? entry.url,
    description: entry.description ?? repo?.description ?? ogp?.description,
    image: entry.image ?? ogp?.image,
    repo,
  };
}

export function loadWorks(entries: WorkEntry[], options: LoadWorksOptions = {}): Promise<Work[]> {
  return Promise.all(entries.map((entry) => loadWork(entry, options)));
}

export interface LanguageShare {
  name: string;
  bytes: number;
  /** 0〜1 */
  share: number;
}

/**
 * 掲載リポジトリの言語別バイト数を合計し、多い順に並べる。
 * maxItems を超えた分は「その他」にまとめる。
 */
export function aggregateLanguages(works: Work[], maxItems = 6): LanguageShare[] {
  const totals = new Map<string, number>();
  for (const work of works) {
    for (const [name, bytes] of Object.entries(work.repo?.languages ?? {})) {
      totals.set(name, (totals.get(name) ?? 0) + bytes);
    }
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  if (sum === 0) return [];

  const sorted = [...totals.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));

  const head = sorted.length > maxItems ? sorted.slice(0, maxItems - 1) : sorted;
  const tail = sorted.slice(head.length);
  const rows = tail.length > 0 ? [...head, { name: 'その他', bytes: tail.reduce((a, b) => a + b.bytes, 0) }] : head;

  return rows.map((row) => ({ ...row, share: row.bytes / sum }));
}
