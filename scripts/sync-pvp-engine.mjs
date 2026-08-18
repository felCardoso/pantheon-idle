#!/usr/bin/env node
/**
 * Generates supabase/functions/_shared/engine/ from src/engine/.
 *
 * WHY THIS EXISTS
 * The PvP resolver is a Supabase Edge Function running on Deno. Edge Functions
 * deploy as a self-contained tree and cannot import from src/ at deploy time,
 * so the engine has to physically exist under supabase/functions/. That copy
 * used to be maintained by hand and had already drifted from the original,
 * which means PvE and PvP could silently resolve the same battle differently.
 *
 * This script makes the copy a build artifact instead: run it after any engine
 * change and the two are identical by construction. Two mechanical transforms
 * are applied, which are the only real differences between the runtimes:
 *   1. Deno requires explicit file extensions on relative imports
 *      (and directory imports spelled out as `/index.ts`).
 *   2. Deno requires an import attribute for JSON modules.
 *
 * Usage:  npm run sync:pvp-engine
 *         npm run sync:pvp-engine -- --check    (CI: fail if out of date)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

const SRC = 'src/engine';
const DEST = 'supabase/functions/_shared/engine';
const checkOnly = process.argv.includes('--check');

/** Every file under `dir`, recursively, as paths relative to `base`. */
function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full)];
  });
}

/**
 * Turns one relative import specifier into the explicit form Deno needs,
 * resolving it against the importing file so a directory import ('../data')
 * becomes '../data/index.ts' rather than the non-existent '../data.ts'.
 */
function denoSpecifier(specifier, importingFile) {
  if (specifier.endsWith('.ts') || specifier.endsWith('.json')) return specifier;
  const absolute = resolve(dirname(join(SRC, importingFile)), specifier);
  if (existsSync(absolute) && statSync(absolute).isDirectory()) return `${specifier}/index.ts`;
  return `${specifier}.ts`;
}

/**
 * Rewrites a TypeScript source for Deno. Only *relative* specifiers are
 * touched — a bare specifier would be an npm/JSR import, which the engine
 * deliberately has none of (being dependency-free is what makes this copy
 * viable at all).
 */
function toDeno(source, importingFile) {
  return source.replace(/(\bfrom\s+)(['"])(\.[^'"]+)\2(\s*with\s*\{[^}]*\})?/g, (_m, keyword, quote, specifier) => {
    const next = denoSpecifier(specifier, importingFile);
    const attribute = next.endsWith('.json') ? " with { type: 'json' }" : '';
    return `${keyword}${quote}${next}${quote}${attribute}`;
  });
}

const BANNER = `// AUTO-GENERATED from src/engine — DO NOT EDIT BY HAND.
// Run \`npm run sync:pvp-engine\` after changing the engine.
// See scripts/sync-pvp-engine.mjs for why this copy exists.
`;

// Tests and the CLI demo are development-only; the Edge Function needs neither.
const files = walk(SRC)
  .filter((f) => f.endsWith('.ts') || f.endsWith('.json'))
  .filter((f) => !f.endsWith('.test.ts') && !f.startsWith('cli/') && !f.endsWith('testUtils.ts'));

const generated = new Map();
for (const file of files) {
  const raw = readFileSync(join(SRC, file), 'utf8');
  generated.set(file, file.endsWith('.json') ? raw : BANNER + toDeno(raw, file));
}

if (checkOnly) {
  const stale = [...generated].filter(([file, content]) => {
    const target = join(DEST, file);
    return !existsSync(target) || readFileSync(target, 'utf8') !== content;
  });
  if (stale.length > 0) {
    console.error(`PvP engine copy is out of date (${stale.length} file(s)). Run: npm run sync:pvp-engine`);
    for (const [file] of stale) console.error(`  - ${file}`);
    process.exit(1);
  }
  console.log(`PvP engine copy is up to date (${generated.size} files).`);
  process.exit(0);
}

// Rebuilt from scratch so a file deleted in src/engine can't linger here.
rmSync(DEST, { recursive: true, force: true });
for (const [file, content] of generated) {
  const target = join(DEST, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
console.log(`Synced ${generated.size} files -> ${DEST}`);
