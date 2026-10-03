import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as sass from 'sass';
import { compileProductionScss, buildSectionStyles } from './component-style.mjs';

test('production excludes demo while standalone builds retain it and shared imports', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'section-css-'));
  try {
    await writeFile(join(dir, '_demo.scss'), '.section-demo-test { color: red; }');
    await writeFile(join(dir, '_shared.scss'), '$color: blue; .shared { color: $color; }');
    for (const quote of ['"', "'"]) {
      const path = join(dir, 'section.scss');
      await writeFile(path, `@import "shared";\n.component { color: $color; }\n@import ${quote}demo${quote};\n`);
      const production = await compileProductionScss(path);
      assert.match(production, /\.component/);
      assert.match(production, /\.shared/);
      assert.doesNotMatch(production, /section-demo/);
      await buildSectionStyles(path);
      assert.match(await readFile(join(dir, 'section.css'), 'utf8'), /section-demo-test/);
      assert.equal((await readFile(join(dir, 'section.min.css'), 'utf8')).trimEnd(), production);
      assert.ok(!production.includes('\uFEFF'));
      assert.match(sass.compile(path, {silenceDeprecations:['import']}).css, /section-demo-test/);
    }
    await writeFile(join(dir, 'section.scss'), '@import "shared";');
    await writeFile(join(dir, '_shared.scss'), '@import "demo";');
    await assert.rejects(compileProductionScss(join(dir, 'section.scss')), /Demo stylesheet/);
  } finally { await rm(dir, {recursive:true, force:true}); }
});
