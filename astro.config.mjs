// astro.config.mjs
import { defineConfig } from 'astro/config';

const TARGET = process.env.DEPLOY_TARGET || 'domain';

const CFG = {
  domain: {
    site: 'https://thearchiveoftheuntamed.xyz/',
    base: '/',
  },
  ghpages: {
    site: 'https://micula1312.github.io/aotu-site/',
    base: '/aotu-site/',
  },
}[TARGET];

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  ...CFG,
  integrations: [],
  vite: {
    server: {
      fs: { allow: ['.'] },
      // ✅ Proxy SOLO in dev per evitare CORS da localhost
      proxy: isProd
        ? undefined
        : {
            '/wp-json': {
              target: 'https://thearchiveoftheuntamed.xyz',
              changeOrigin: true,
              secure: false,
              rewrite: p => p,
            },
            '/wp': {
              target: 'https://thearchiveoftheuntamed.xyz',
              changeOrigin: true,
              secure: false,
              rewrite: p => p,
            },
          },
    },
  },
});
