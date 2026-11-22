/**
 * GitHub のリポジトリ情報（説明・言語・スター数・更新日）をビルド時に取得する。
 * 環境変数 GITHUB_TOKEN があれば使う（未認証だと 1 時間あたり 60 リクエストまで）。
 */
import { resolveHttpUrl, type Fetcher } from './ogp';

export interface RepoInfo {
  owner: string;
  name: string;
  description?: string;
  /** GitHub が判定した主要言語 */
  language?: string;
  stars: number;
  /** ISO 8601 */
  pushedAt?: string;
  homepage?: string;
  archived: boolean;
  /** 言語ごとのバイト数 */
  languages: Record<string, number>;
}

export interface GitHubOptions {
  token?: string;
  fetcher?: Fetcher;
}

const API = 'https://api.github.com';
const TIMEOUT_MS = 10_000;

/** github.com/{owner}/{repo} 形式の URL なら owner と repo を返す */
export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return undefined;
  const [owner, repo] = parsed.pathname.split('/').filter(Boolean);
  if (!owner || !repo) return undefined;
  return { owner, repo: repo.replace(/\.git$/, '') };
}

/** 「example.com」のようにスキームなしで登録されたホームページにも対応する */
export function normalizeHomepage(value: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return resolveHttpUrl(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`, 'https://github.com');
}

async function getJson<T>(path: string, { token, fetcher = fetch }: GitHubOptions): Promise<T | undefined> {
  try {
    const res = await fetcher(`${API}${path}`, {
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const hint = remaining === '0' ? '（API の回数制限。GITHUB_TOKEN を設定してください）' : '';
      console.warn(`[github] ${path}: HTTP ${res.status}${hint}`);
      return undefined;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`[github] ${path}: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}

interface RepoResponse {
  name: string;
  owner: { login: string };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
  homepage: string | null;
  archived: boolean;
}

export async function fetchRepo(owner: string, repo: string, options: GitHubOptions = {}): Promise<RepoInfo | undefined> {
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const [info, languages] = await Promise.all([
    getJson<RepoResponse>(base, options),
    getJson<Record<string, number>>(`${base}/languages`, options),
  ]);
  if (!info) return undefined;
  return {
    owner: info.owner.login,
    name: info.name,
    description: info.description ?? undefined,
    language: info.language ?? undefined,
    stars: info.stargazers_count,
    pushedAt: info.pushed_at ?? undefined,
    homepage: normalizeHomepage(info.homepage),
    archived: info.archived,
    languages: languages ?? {},
  };
}
