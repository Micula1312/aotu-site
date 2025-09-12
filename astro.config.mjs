// astro.config.mjs
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';

const TARGET = process.env.DEPLOY_TARGET || 'domain';

const CFG = {
  domain: {
    site: 'https://thearchiveoftheuntamed.xyz',
    base: '/',
  },
  ghpages: {
    site: 'https://micula1312.github.io',
    base: '/aotu-site/',
  },
}[TARGET];

const isProd = process.env.NODE_ENV === 'production';

// WP locale usato SOLO per il proxy in dev
// (qui è http://localhost perché il tuo WP risponde a http://localhost/wp-json/)
const WP_TARGET = process.env.WP_TARGET || 'http://localhost';

export default defineConfig({
  ...CFG,
  integrations: [],
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      fs: { allow: ['.'] },
      proxy: isProd ? undefined : {
        '/wp-json': {
          target: WP_TARGET,
          changeOrigin: true,
          secure: false,
        },
        '/wp': {
          target: WP_TARGET,
          changeOrigin: true,
          secure: false,
        },
        '/wp-content': {
          target: WP_TARGET,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
});
