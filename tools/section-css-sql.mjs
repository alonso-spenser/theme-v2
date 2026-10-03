import {readFile, writeFile, mkdir, realpath} from 'node:fs/promises';
import {resolve, sep, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {compileProductionScss, buildSectionStyles} from './component-style.mjs';

/** Generate an existing-record CSS update only from verified production output. */
export async function cssUpdateSql(directory, key) {
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(key)) throw new Error('Expected type/salt');
  const [type, salt] = key.split('/');
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  if (manifest.type !== type || manifest.templateId !== salt || manifest.runtimeVersion !== 2) {
    throw new Error('V2 manifest identity does not match directory');
  }
  const css = await readFile(resolve(directory, 'section.min.css'), 'utf8');
  if (css.trimEnd() !== await compileProductionScss(resolve(directory, 'section.scss'))) {
    throw new Error('section.min.css is stale or contains demo styles; rebuild first');
  }
  const hex = value => `CONVERT(0x${Buffer.from(value).toString('hex')} USING utf8mb4)`;
  return `-- CSS-only update for ${key}; generated from section.min.css, never section.css.\n` +
    `-- Back up the target record before executing. Affected rows must be 1.\nSTART TRANSACTION;\n` +
    `UPDATE mall.theme_section SET base_css=${hex(css)}, salt=LEFT(REPLACE(UUID(),'-',''),10)\n` +
    `WHERE section_code=${hex(type+'.'+salt)} AND JSON_EXTRACT(section_schema,'$.runtimeVersion')=2;\n` +
    `SELECT ROW_COUNT() AS updated_sections;\nCOMMIT;\n`;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const key = process.argv[2];
  if (!key || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(key)) throw new Error('Usage: npm run section:css:sql -- type/salt');
  const sections = await realpath(resolve(root, 'section'));
  const directory = await realpath(resolve(sections, key));
  if (!directory.startsWith(sections+sep)) throw new Error('Component must be inside section/');
  await buildSectionStyles(resolve(directory, 'section.scss'));
  const sql = await cssUpdateSql(directory, key);
  const output = resolve(root, 'dist', 'database', key, 'base-css.sql');
  await mkdir(dirname(output), {recursive:true});
  await writeFile(output, sql);
  console.log(`Generated ${output}; database was not modified.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  import('./section-sql.mjs').then(module => module.main()).catch(error => { console.error(error.message); process.exitCode = 1; });
}
