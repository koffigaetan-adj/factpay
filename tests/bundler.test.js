// next.config.js ne doit pas contenir de config webpack : depuis la version 16, Turbopack est le
// bundler par défaut et refuse de démarrer si une config webpack est présente sans son équivalent
// turbopack. Une config webpack oubliée fait donc échouer `next build` sur TOUS les postes, même
// ceux où Turbopack fonctionne normalement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../next.config.js', import.meta.url), 'utf8');

test('next.config.js ne déclare pas de config webpack', () => {
  assert.doesNotMatch(
    config,
    /^\s*webpack\s*[:(]/m,
    'une config webpack sans config turbopack fait échouer le build Next 16',
  );
});

test('le script de lancement choisit le bundler disponible', async () => {
  const runner = await readFile(new URL('../scripts/next-run.js', import.meta.url), 'utf8');
  assert.match(runner, /--webpack/, 'il doit savoir basculer sur Webpack');
  assert.match(runner, /@next\/swc-/, 'il doit tester la disponibilité des bindings natifs');
});
