import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('./base.css', import.meta.url), 'utf8');
assert.match(css, /dl, ol, ol ol, ol ul, ul, ul ol, ul ul \{\s*margin-bottom: 0;\s*padding-left: 0;\s*\}/);
assert.match(css, /\nli \{\s*list-style: none;\s*\}/);
assert.match(css, /\na \{[^}]*text-decoration: none;/);
assert.match(css, /\na:hover \{[^}]*text-decoration: none;/);
for (const name of ['container', 'container-full', 'container-fluid', 'container-xxl', 'row', 'col', 'col-12', 'col-md-6', 'col-xxl-4', 'offset-lg-2', 'row-cols-md-3', 'g-0', 'gx-3', 'gy-3', 'form-control', 'form-select', 'form-check-input', 'form-switch', 'form-range', 'input-group', 'form-floating', 'invalid-feedback', 'd-md-flex', 'justify-content-between']) {
  assert.ok(css.includes(`.${name}`), `Missing ${name}`);
}
for (const name of ['btn-primary', 'btn-outline-primary', 'btn-sm', 'btn-lg', 'h1', 'h6']) assert.ok(css.includes(`.${name}`));
// Input-group references .dropdown-menu for border radii; no dropdown module is emitted.
assert.ok(!/^\.dropdown-menu\s*\{/m.test(css));
for (const name of ['modal', 'carousel', 'navbar', 'table-striped']) {
  assert.ok(!new RegExp(`\\.${name}(?![\\w-])`).test(css), `Unwanted module ${name}`);
}
// Project page styles define .card; Bootstrap's card component is still excluded.
assert.ok(!css.includes('--bs-card-spacer-y:'));
for (const width of [576, 768, 992, 1200, 1400]) assert.ok(css.includes(`min-width: ${width}px`));
const page = await readFile(new URL('./page/base.css', import.meta.url), 'utf8');
assert.ok(page.includes('var(--colorTheme'));
assert.ok(page.includes('var(--fontSizeBody'));
assert.equal((page.match(/--colorTheme:/g) || []).length, 1);
assert.ok(!page.includes('@import'));
assert.ok(!page.includes('[[${'));
assert.ok(!page.includes('.slick'));
assert.ok(!page.includes('.FvyQV3'));
assert.ok(!page.includes('font-size: var(--colorBody)'));
for (const selector of ['.text-headline', '.text-menu', '.section-padding', '.card-title', '.sidebar', '.bread-crumb', '.section-title-divider']) assert.ok(page.includes(selector));
console.log('PASS: containers, responsive grid, forms, buttons, headings, global variables, omitted modules');
