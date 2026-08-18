import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack(config) {
    // Wiki content (src/data/wiki.ts) imports .md files as raw text, not MDX/JSX —
    // Vite handled this via a `?raw` query; webpack's built-in asset/source module
    // type is the equivalent for plain, non-MDX markdown-as-string imports.
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
