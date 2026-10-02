// Lance `next dev` / `next build` avec le bon bundler, sans y penser à chaque fois.
//
// Depuis la version 16, Next utilise Turbopack par défaut. Or Turbopack exige les bindings natifs
// de la plateforme (@next/swc-<plateforme>) : sur un poste où une politique de contrôle d'application
// (Windows Defender Application Control, AppLocker…) bloque les fichiers .node, le chargement échoue,
// Next bascule sur ses bindings WebAssembly… qui ne suffisent pas à Turbopack. Résultat : `next dev`
// et `next build` s'arrêtent sur « Turbopack is not supported on this platform ».
//
// Ce script tente de charger les bindings natifs. Si c'est possible, Turbopack est utilisé (rapide).
// Sinon, on repasse sur Webpack, qui n'a besoin que de JavaScript et fonctionne partout. Les postes
// normals et la CI gardent donc Turbopack : personne ne perd sa vitesse pour réparer un seul poste.
//
// Forcer un bundler reste possible : NEXT_FORCE_WEBPACK=1 npm run build, ou NEXT_FORCE_TURBOPACK=1.
import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const forced = process.env.NEXT_FORCE_WEBPACK ? 'webpack'
  : process.env.NEXT_FORCE_TURBOPACK ? 'turbopack'
    : null;

let useWebpack = forced === 'webpack';
if (!forced) {
  try {
    // Next charge ses bindings natifs via @next/swc-<plateforme>-<arch>. On tente le même paquet
    // pour la plateforme courante : s'il ne se charge pas, Turbopack ne pourra pas démarrer.
    const { platform, arch } = process;
    const abi = platform === 'win32' ? 'msvc' : platform === 'darwin' ? 'darwin' : 'gnu';
    require(`@next/swc-${platform}-${arch}-${abi}`);
  } catch {
    useWebpack = true;
  }
}

const args = [process.argv[2], ...process.argv.slice(3)];
if (useWebpack) args.push('--webpack');

// `next build` vide tout son distDir avant de reconstruire. Si le serveur de dev tourne en parallèle
// dans le même dossier, il se retrouve avec un manifeste qui pointe vers des fichiers supprimés :
// « ENOENT … .next/dev/server/app/…/page.js ». On donne donc à `next dev` son propre dossier de
// cache, pour qu'un build puisse être lancé pendant que le dev tourne (et inversement).
const runEnv = { ...process.env };
if (args[0] === 'dev' && !process.env.NEXT_DIST_DIR) {
  runEnv.NEXT_DIST_DIR = '.next-dev';
}

if (useWebpack) {
  console.log('[bundler] Bindings natifs Next indisponibles : utilisation de Webpack.');
}
if (runEnv.NEXT_DIST_DIR) {
  console.log(`[cache] Dossier de construction : ${runEnv.NEXT_DIST_DIR}`);
}

const child = spawn('node', [require.resolve('next/dist/bin/next'), ...args], {
  stdio: 'inherit',
  env: runEnv,
});

// Leaving the signal to Next itself, otherwise Ctrl+C kills the wrapper but not the dev server.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
