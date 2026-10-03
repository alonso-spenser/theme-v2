import { writeFile, readdir } from 'node:fs/promises';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as sass from 'sass';
import { join } from 'node:path';
import { compileProductionScss, buildSectionStyles } from '../tools/component-style.mjs';

async function build() {
  for (const directory of ['./', './page/']) {
  const input = fileURLToPath(new URL(directory + 'base.scss', import.meta.url));
  for (const [style, name] of [['expanded', 'base.css'], ['compressed', 'base.min.css']]) {
    const cssBody = style === 'compressed' ? await compileProductionScss(input) : sass.compile(input, {
      style,
      charset: false, // Keep generated CSS safe when a banner or other styles precede it.
      // Bootstrap 5 upstream Sass still uses these deprecated APIs.
      silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
    }).css;
    const body = cssBody + '\n';
    const version = createHash('sha256').update(body).digest('hex').slice(0, 6);
    const css = `/*! Theme v2 Bootstrap 5.3.8 subset | MIT | vendor/bootstrap/LICENSE | version: ${version} */\n` + body;
    await writeFile(new URL(directory + name, import.meta.url), css);
    if (style === 'compressed') {
      const hashedName = `base.min.${version}.css`;
      await writeFile(new URL(directory + hashedName, import.meta.url), css);
      console.log(`Built ${directory}${hashedName}`);
    }
    console.log(`${fileURLToPath(new URL(directory + name, import.meta.url))}: version ${version}; ${Buffer.byteLength(css)} bytes; gzip ${gzipSync(css).length} bytes`);
  }
  }
  // Build every section with the same demo/production split as single-component publishing.
  const sections = fileURLToPath(new URL('../section/', import.meta.url));
  let count = 0;
  for (const type of await readdir(sections, { withFileTypes: true })) {
    if (!type.isDirectory()) continue;
    for (const component of await readdir(join(sections, type.name), { withFileTypes: true })) {
      if (!component.isDirectory()) continue;
      const directory = join(sections, type.name, component.name);
      if (!(await readdir(directory)).includes('section.scss')) continue;
      await buildSectionStyles(join(directory, 'section.scss'));
      count++;
    }
  }
  console.log(`Built ${count} section CSS pairs: .css includes demo; .min.css excludes demo.`);
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
  for (const directory of ['./', '../js', '../section']) {
    watch(new URL(directory, import.meta.url), { recursive: true }, (_, filename) => {
      if (!filename || !/\.s[ac]ss$/i.test(String(filename))) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void rebuild(); }, 150);
    });
  }
  await rebuild();
  console.log('Watching V2 SCSS; rebuilding framework and section CSS pairs on changes.');
} else {
  await build();
}
