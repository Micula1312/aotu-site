// astro.config.mjs

import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

// ENV & TARGET
const DEPLOY_TARGET = process.env.DEPLOY_TARGET || 'domain'; // 'ghpages' | 'domain'
const isProd = process.env.NODE_ENV === 'production';

// Dominio pubblico del sito (serve a sitemap/links assoluti)
const SITE_BY_TARGET = {
  ghpages: 'https://micula1312.github.io',
  domain: 'https://thearchiveoftheuntamed.xyz',
};
const site = SITE_BY_TARGET[DEPLOY_TARGET] || SITE_BY_TARGET.domain;

// Base URL: in dev SEMPRE '/', in prod dipende dal target
const base = isProd
  ? (DEPLOY_TARGET === 'ghpages' ? '/aotu-site/' : '/')
  : '/';

// WordPress headless target (con /wp finale!)
const WP_TARGET = process.env.WP_TARGET || 'https://thearchiveoftheuntamed.xyz/wp';

// Config Astro
export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: process.env.NODE_ENV === 'production' ? undefined : {
        '/wp-json':    { target: WP_TARGET, changeOrigin: true, secure: false },
        '/wp':         { target: WP_TARGET, changeOrigin: true, secure: false },
        '/wp-content': { target: WP_TARGET, changeOrigin: true, secure: false },
      },
    },
  },
});
