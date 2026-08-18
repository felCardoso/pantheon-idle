#!/usr/bin/env node
/**
 * Enforces the engine/view separation.
 *
 * The engine is a pure, framework-agnostic simulation: it must be runnable in
 * the browser (PvE), in Deno (the PvP Edge Function) and in a terminal harness
 * with no adapters. That only stays true if nothing drags a framework, a
 * browser global or a presentation concern into it — and if consumers stop
 * reaching into its internals, which quietly turns every private detail into
 * public API.
 *
 * Five rules, each a real failure mode rather than style policing:
 *
 *   1. IN  — src/engine/** must not import anything outside src/engine.
 *   2. IN  — src/engine/** must not import a bare module (react, next, npm…).
 *   3. IN  — src/engine/** must not touch browser/Node globals.
 *   4. IN  — src/engine/** must not carry presentation concerns (colours,
 *            CSS classes, icon/portrait fields).
 *   5. OUT — nothing outside src/engine may deep-import into it; the only
 *            legal specifier is the public API barrel, src/engine/index.ts.
 *
 * Usage: node scripts/check-engine-boundary.mjs   (run by `npm run lint`)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const ENGINE = 'src/engine';
const PUBLIC_API = resolve(ENGINE, 'index.ts');

/** Directories scanned for rule 4 — everything that consumes the engine. */
const CONSUMER_ROOTS = ['src', 'app', 'lib', 'tools'];

const SOURCE = /\.(ts|tsx|mts)$/;
const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', '.git']);

function walk(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (SOURCE.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Matches every way a module can be pulled in, not just `from '…'`:
 *   import x from 'a'  |  import 'a'  (side-effect)  |  import('a')  |  require('a')
 * The side-effect form has no `from` and was invisible to an earlier version of
 * this check, which let `import 'react'` slip straight past it.
 */
const importRe = /(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const violations = [];
const add = (file, rule, detail) => violations.push({ file, rule, detail });

// --- Rules 1-3: nothing foreign gets into the engine -------------------------
// Tests never ship: sync-pvp-engine.mjs excludes them from the Deno build, so
// their vitest/testUtils imports are not a portability risk.
const isTestFile = (f) => f.endsWith('.test.ts') || f.endsWith('testUtils.ts');
const engineFiles = walk(ENGINE).filter((f) => !isTestFile(f));
const engineRoot = resolve(ENGINE);

// Deliberately narrow: these are globals that would break Deno/SSR, and
// presentation fields that signal view logic drifting in. Matching is on real
// code only — comments are stripped first so prose about the UI is allowed.
const FORBIDDEN_GLOBALS = /\b(window|document|localStorage|sessionStorage|navigator|process\.env|__dirname)\b/;
const PRESENTATION = /\b(className|portraitUrl|iconName|cssClass)\b|#[0-9a-fA-F]{6}\b|\brgba?\(/;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

for (const file of engineFiles) {
  const raw = readFileSync(file, 'utf8');
  const code = stripComments(raw);

  for (const [, specifier] of code.matchAll(importRe)) {
    if (!specifier.startsWith('.')) {
      add(file, 'no-bare-imports', `imports '${specifier}' — the engine must stay dependency-free`);
      continue;
    }
    const target = resolve(file, '..', specifier);
    if (target !== engineRoot && !target.startsWith(engineRoot + sep)) {
      add(file, 'engine-is-hermetic', `imports '${specifier}', which escapes ${ENGINE}/`);
    }
  }

  const global = code.match(FORBIDDEN_GLOBALS);
  if (global) add(file, 'no-host-globals', `uses '${global[0]}' — breaks Deno/SSR portability`);

  const presentation = code.match(PRESENTATION);
  if (presentation) add(file, 'no-presentation', `contains '${presentation[0]}' — a view concern`);
}

// --- Rule 4: consumers may only use the public API ---------------------------
for (const root of CONSUMER_ROOTS) {
  let files;
  try {
    files = walk(root);
  } catch {
    continue; // optional directory
  }
  for (const file of files) {
    if (resolve(file).startsWith(engineRoot + sep)) continue; // the engine itself
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(importRe)) {
      if (!specifier.includes('engine')) continue;
      const target = resolve(file, '..', specifier);
      if (!target.startsWith(engineRoot + sep) && target !== engineRoot) continue;

      // Legal: '…/engine' (the directory, resolving to index.ts) or the barrel itself.
      const isPublicApi = target === engineRoot || resolve(target) === PUBLIC_API || resolve(target + '.ts') === PUBLIC_API;
      if (!isPublicApi) {
        add(file, 'no-deep-imports', `imports '${specifier}' — use the public API ('…/engine') instead`);
      }
    }
  }
}

// --- Report ------------------------------------------------------------------
if (violations.length === 0) {
  console.log(`Engine boundary OK — ${engineFiles.length} engine files, all 5 rules satisfied.`);
  process.exit(0);
}

console.error(`Engine boundary violated (${violations.length}):\n`);
const byRule = violations.reduce((acc, v) => ((acc[v.rule] ??= []).push(v), acc), {});
for (const [rule, items] of Object.entries(byRule)) {
  console.error(`  [${rule}]`);
  for (const { file, detail } of items) console.error(`    ${relative(process.cwd(), file)}: ${detail}`);
  console.error('');
}
console.error('See src/engine/index.ts for what the engine exposes and why.');
process.exit(1);
