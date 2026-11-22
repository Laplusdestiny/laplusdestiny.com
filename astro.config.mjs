// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://laplusdestiny.com',
  output: 'static',
  integrations: [sitemap()],
  image: {
    // 作品の OGP 画像（任意のサイト）とギャラリーの写真を、ビルド時に取得して最適化する
    remotePatterns: [{ protocol: 'https' }],
  },
  vite: {
    plugins: [tailwindcss(), Icons({ compiler: 'astro' })],
  },
});
