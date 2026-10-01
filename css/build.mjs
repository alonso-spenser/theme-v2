import { writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import * as sass from 'sass';

async function build() {
  for (const directory of ['./', './page/']) {
  const input = fileURLToPath(new URL(directory + 'base.scss', import.meta.url));
  for (const [style, name] of [['expanded', 'base.css'], ['compressed', 'base.min.css']]) {
    const result = sass.compile(input, {
      style,
      charset: false, // Keep generated CSS safe when a banner or other styles precede it.
      // Bootstrap 5 upstream Sass still uses these deprecated APIs.
      silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
    });
    const css = '/*! Theme v2 Bootstrap 5.3.8 subset | MIT | vendor/bootstrap/LICENSE */\n' + result.css + '\n';
    await writeFile(new URL(directory + name, import.meta.url), css);
    console.log(`${fileURLToPath(new URL(directory + name, import.meta.url))}: ${Buffer.byteLength(css)} bytes; gzip ${gzipSync(css).length} bytes`);
  }
  }
}

if (process.argv.includes('--watch')) {
  let timer;
  let pending = false;
  let running = false;
  async function rebuild() {
    pending = true;
    if (running) return;
    running = true;
    try {
      while (pending) {
        pending = false;
        try { await build(); }
        catch (error) { console.error(error.toString()); }
      }
    } finally { running = false; }
  }
  // Both V2 entries import shared SCSS, including the native section runtime.
  for (const directory of ['./', '../js']) {
    watch(new URL(directory, import.meta.url), { recursive: true }, (_, filename) => {
      if (!filename || !/\.s[ac]ss$/i.test(String(filename))) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void rebuild(); }, 150);
    });
  }
  await rebuild();
  console.log('Watching V2 SCSS; rebuilding base.css and base.min.css on changes.');
} else {
  await build();
}
