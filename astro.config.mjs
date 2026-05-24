// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  vite: {
    plugins: [
      tailwindcss(),
      Icons({ compiler: 'astro' }),
    ],
  },
});
