const { build } = require('esbuild');
const { copyFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

const DIST = join(__dirname, 'dist');
const STATIC_DIR = join(DIST, 'webview-static');

(async () => {
  if (!existsSync(DIST)) {
    mkdirSync(DIST, { recursive: true });
  }
  if (!existsSync(STATIC_DIR)) {
    mkdirSync(STATIC_DIR, { recursive: true });
  }

  // Copy webview static files (CSS, HTML) to dist/webview-static/
  const webviewStaticFiles = ['erd-v2.css', 'erd-v2-shell.html', 'erd-v2-history-panel.html'];
  for (const f of webviewStaticFiles) {
    copyFileSync(
      join(__dirname, 'src', 'webviews', 'erd-v2-split', f),
      join(STATIC_DIR, f)
    );
  }

  // Copy pino's own worker/file transports (they have minimal deps)
  copyFileSync(
    join(__dirname, 'node_modules/pino/lib/worker.js'),
    join(DIST, 'pino-worker.js')
  );
  copyFileSync(
    join(__dirname, 'node_modules/pino/file.js'),
    join(DIST, 'pino-file.js')
  );

  // Bundle the @salesforce/core transport file separately
  // (it has deps on ../util/unwrapArray, ./filters, pino-abstract-transport)
  await build({
    entryPoints: [
      'node_modules/@salesforce/core/lib/logger/transformStream.js',
    ],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: 'dist/sf-transform-stream.js',
  });

  // The transport target from @salesforce/core Logger is:
  //   path.join('..', '..', 'lib', 'logger', 'transformStream')
  // which produces "../../lib/logger/transformStream"
  const sfTransportTarget = join('..', '..', 'lib', 'logger', 'transformStream');

  // Bundle the main extension
  await build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    banner: {
      js: [
        `globalThis.__bundlerPathsOverrides = {`,
        `  'pino-worker': require('path').join(__dirname, 'pino-worker.js'),`,
        `  'pino/file': require('path').join(__dirname, 'pino-file.js'),`,
        `  '${sfTransportTarget}': require('path').join(__dirname, 'sf-transform-stream.js'),`,
        `};`,
      ].join('\n'),
    },
  });
})();
