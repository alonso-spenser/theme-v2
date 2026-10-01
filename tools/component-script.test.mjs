import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productionComponentScript as clean} from './component-script.mjs';

test('preserves registration and removes trailing demo bootstrap', () => {
  const main = '(() => { fo.register("salt", class {}); })();\n';
  assert.equal(clean(main + '// Standalone DEMO only; normal preview initializes in the page shell.\nif (document.currentScript?.hasAttribute("data-demo-init")) {\n fo.init(JSON.parse(document.getElementById("demo-config").textContent));\n}\n').trim(), main.trim());
});
test('removes demo initialization within IIFE, with or without braces', () => {
  for (const statement of ['fo.init({preview: true});', '{ fo.init({preview: true}); }']) {
    assert.equal(clean(`(() => {\n  if (document.currentScript?.hasAttribute('data-demo-init')) ${statement}\n})();`), '(() => {\n})();');
  }
});
test('fails closed on unknown initialization patterns', () => {
  assert.throws(() => clean('fo.init({});'));
  assert.throws(() => clean('const config = document.getElementById("demo-config");'));
});
