# laplusdestiny.com

[laplusdestiny.com](https://laplusdestiny.com) のポートフォリオサイト。Astro で静的に生成し、Cloudflare（Workers Builds）でデプロイしています。

## 開発

```sh
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # dist/ に出力
pnpm test     # データ取得まわりの単体テスト
pnpm check    # 型チェック
```

pnpm のバージョンは `package.json` の `packageManager` で固定しています（Cloudflare のビルドもこれを使います）。

## 内容の更新

| 変えたいもの | 編集するファイル |
| --- | --- |
| 自己紹介 | `src/data/profile.json` |
| 作品（Works） | `src/data/works.json` |
| スキル | `src/data/skills.json` |
| 写真 | `src/data/gallery.json` |
| SNS などのリンク | `src/data/links.json`（フッターのアイコンも同じデータ） |

### 作品を載せる

`src/data/works.json` に URL を並べるだけです。GitHub のリポジトリなら、名前・説明・言語・スター数・更新日を GitHub API から、画像を OGP から、ビルド時に取得します。GitHub 以外のサイトは OGP（タイトル・説明・画像）を使います。

```json
{
  "works": [
    { "url": "https://github.com/Laplusdestiny/setlistic" },
    { "url": "https://example.com/app", "title": "表示名を変えたいとき", "description": "説明を変えたいとき" }
  ]
}
```

`title` / `description` / `image` を書くと、取得した値より優先されます。取得に失敗してもビルドは止まらず、その項目なしで表示されます。

### 写真を載せる

`src/data/gallery.json` に画像の URL と説明（`alt`）を追加します。画像はビルド時に取得して WebP に変換し、サイトと一緒に配信します（元画像のサーバーへ直接リンクはしません）。

## ビルド時に外部から取得するデータ

| データ | 取得元 | 失敗したとき |
| --- | --- | --- |
| 作品の情報 | GitHub API / 各ページの OGP | その項目を省いて表示 |
| ブログの記事一覧と投稿数 | `https://blog.laplusdestiny.com/feed.xml` | ブログ欄ごと非表示 |
| 作品の画像・写真 | 各 URL | 画像なしで表示 |

環境変数（Cloudflare の **Settings > Build > Variables and secrets** に設定）:

| 名前 | 用途 |
| --- | --- |
| `GITHUB_TOKEN` | 任意。GitHub API の回数制限（未認証は 1 時間 60 回）を避けるため。公開リポジトリの読み取り権限だけのトークンで足ります |
| `BLOG_FEED_URL` | 任意。ブログのフィード URL を変えるとき |

## 定期的な再ビルド

ブログや GitHub の更新は、再ビルドしたときに反映されます。`.github/workflows/scheduled-rebuild.yml` が毎日 1 回、Cloudflare の Deploy Hook を呼んで再ビルドします。有効にするには:

1. Cloudflare ダッシュボードの **Workers & Pages** でこのサイトを選び、**Settings > Builds > Deploy Hooks** でフックを作成（ブランチは `main`）
2. 表示された URL を、GitHub リポジトリの **Settings > Secrets and variables > Actions** に `CLOUDFLARE_DEPLOY_HOOK_URL` として登録

手動で再ビルドしたいときは、GitHub の Actions タブから **Scheduled rebuild** を実行します。
