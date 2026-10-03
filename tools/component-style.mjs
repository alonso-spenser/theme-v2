import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import * as sass from 'sass';

/** Compile publishable styles without the standalone demo instance stylesheet. */
export async function compileProductionScss(path) {
  const source = (await readFile(path, 'utf8')).replace(
    /^[\t ]*@import\s+(["'])demo\1\s*;[\t ]*(?:\r?\n|$)/gm, ''
  );
  const result = sass.compileString(source, {
    url: pathToFileURL(path), style: 'compressed', charset: false,
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  });
  // Reject indirect demo imports instead of silently publishing demo CSS.
  if (result.loadedUrls.some(url => url.protocol === 'file:' && /^_?demo\.s[ac]ss$/.test(basename(fileURLToPath(url))))) {
    throw new Error(`Demo stylesheet must not be included in production: ${path}`);
  }
  return result.css;
}

/** Keep readable demo CSS separate from the only stylesheet eligible for publication. */
export async function buildSectionStyles(path) {
  const production = await compileProductionScss(path);
  const demo = sass.compile(path, {
    style: 'expanded', charset: false,
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  }).css;
  await writeFile(path.replace(/\.scss$/, '.css'), demo + '\n');
  await writeFile(path.replace(/\.scss$/, '.min.css'), production + '\n');
  return { demo, production };
}
