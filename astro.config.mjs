// astro.config.mjs
import { defineConfig } from 'astro/config';

// Imposta il target via env: DEPLOY_TARGET=domain | ghpages
const TARGET = process.env.DEPLOY_TARGET || 'domain';

const CFG = {
  domain: {
    site: 'https://thearchiveoftheuntamed.xyz/',
    base: '/', // Astro in root del dominio
  },
  ghpages: {
    site: 'https://micula1312.github.io/aotu-site/',
    base: '/aotu-site/', // nome repo
  },
}[TARGET];

export default defineConfig({
  ...CFG,
  integrations: [],
  vite: {
    server: { fs: { allow: ['.'] } }
  }
});
