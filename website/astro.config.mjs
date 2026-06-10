import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

// Netlify deploys to root (/), GitHub Pages deploys to /LiveClawBench/
const base = process.env.NETLIFY ? '/' : '/LiveClawBench';
const site = process.env.NETLIFY
  ? process.env.DEPLOY_PRIME_URL || 'https://liveclawbench.netlify.app'
  : 'https://mosi-ai.github.io/LiveClawBench';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  integrations: [
    react(),
    mdx(),
    tailwind(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
  vite: {
    ssr: {
      noExternal: ['@tanstack/react-table'],
    },
  },
});
