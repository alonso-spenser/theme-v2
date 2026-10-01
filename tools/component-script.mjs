import {Script} from 'node:vm';

// Only remove the explicitly marked standalone-demo bootstrap, never component logic.
export function productionComponentScript(source) {
  const cleaned = source
    .replace(/^\s*\/\/ Standalone DEMO only;[^\n]*\n/gm, '\n')
    .replace(/^[ \t]*if\s*\(document\.currentScript\?\.hasAttribute\(['"]data-demo-init['"]\)\)\s*(?:\{\s*fo\.init\([^;]*\);\s*\}|fo\.init\([^;]*\);)[ \t]*\r?\n?/gm, '');
  if (/data-demo-init|demo-config|\bfo\.init\s*\(/.test(cleaned)) {
    throw new Error('Component script still contains page/demo initialization; refusing publication');
  }
  new Script(cleaned);
  return cleaned;
}
