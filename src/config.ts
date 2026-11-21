/** サイト全体の設定。URL を変えるときはここと astro.config.mjs の site を合わせる */
export const SITE_URL = 'https://laplusdestiny.com';
export const SITE_NAME = 'Laplusdestiny';
export const SITE_DESCRIPTION =
  'Laplusdestiny のポートフォリオ。データ分析・機械学習・システム開発の作品、ブログ、写真をまとめています。';

export const BLOG_URL = 'https://blog.laplusdestiny.com';

// 以下はビルド時（Node.js 上）にだけ読む。Cloudflare のビルド変数で上書きできる
/** ブログのフィード。環境変数 BLOG_FEED_URL で上書きできる */
export const BLOG_FEED_URL = process.env.BLOG_FEED_URL || `${BLOG_URL}/feed.xml`;
/** GitHub API 用のトークン（任意）。未設定だと API は 1 時間 60 回までになる */
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || undefined;
