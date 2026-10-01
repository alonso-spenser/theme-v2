import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildIndex(directory) {
  const root = resolve(directory);
  const catalog = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'));
  let report = { results: [] };
  try { report = JSON.parse(await readFile(join(root, 'verification.json'), 'utf8')); } catch {}
  const escape = value => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const groups = new Map();
  const chineseNames = { 'Banner': '横幅', 'Contact US': '联系我们', 'FAQ': '常见问题',
    'SERVICE PAGE': '服务页面', 'SERVICES': '服务展示', 'SOLUTIONS': '解决方案',
    'Our Services': '我们的服务', 'CHOOSE A PLAN': '选择方案', 'Mission': '使命',
    'Slogan': '标语', 'SVG placeholder': 'SVG 占位图', 'Youtube video': 'YouTube 视频' };
  for (const component of catalog.components) {
    const manifest = JSON.parse(await readFile(join(root, component.key, 'manifest.json'), 'utf8'));
    const checks = report.results.filter(r => r.key === component.key && r.renderStatus === 200 && r.styleStatus === 200);
    const fixture = ['local', 'sample', 'default'].find(name => checks.some(r => r.fixture === name))
      || (component.fixtures.includes('local') ? 'local' : component.fixtures.includes('sample') ? 'sample' : 'default');
    component.preview = `./${component.key}/index.html`;
    const rawZh = manifest.name?.['zh-CN'] || component.name || component.type;
    const zh = chineseNames[rawZh] || rawZh;
    const english = manifest.name?.en;
    const en = english && /[A-Za-z]/.test(english) ? english : component.type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
    component.names = { 'zh-CN': zh, en };
    const status = 'V2 静态 DEMO · 视觉与业务交互待逐项验收';
    const hasDemo = (await readFile(join(root, component.key, 'index.html'), 'utf8').catch(() => '')).includes('theme:standalone-demo');
    const demoLink = hasDemo ? `<a target="_blank" rel="noopener" href="./${escape(component.key)}/index.html">静态 HTML DEMO</a> · ` : '';
    const item = `<dd><a target="_blank" rel="noopener" href="${escape(component.preview)}"><span>${escape(zh)}</span><span class="english">${escape(en)}</span><code>${escape(component.salt)}</code></a><small>${status}</small></dd>`;
    if (!groups.has(component.type)) groups.set(component.type, []);
    groups.get(component.type).push(item);
    const indexPath = join(root, component.key, 'index.html');
    let standaloneDemo = false;
    try {
      standaloneDemo = (await readFile(indexPath, 'utf8')).includes('<!-- theme:standalone-demo');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!standaloneDemo) await writeFile(indexPath, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escape(zh)} · ${escape(en)}</title></head><body><a target="_blank" rel="noopener" href="${escape(component.preview)}">${escape(zh)} / ${escape(en)} — ${escape(component.salt)}：打开预览</a></body></html>\n`);
  }
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>V2 组件开发目录</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f7f8fa;color:#223047;font:15px/1.6 system-ui,-apple-system,sans-serif}
    main{max-width:1440px;margin:36px auto;padding:0 24px}h1{font-size:28px;margin:0 0 8px}p{color:#637087}
    .section-container{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;align-items:start}
    dl{margin:0;padding:18px;background:white;border:1px solid #e1e6ee;border-radius:8px}dt{font-weight:700;margin-bottom:10px;overflow-wrap:anywhere}
    dd{margin:0;padding:12px 0;border-top:1px solid #edf0f4}a{color:#205db0;text-decoration:none}a:hover{text-decoration:underline}a:focus-visible{outline:2px solid #205db0}
    a span{display:block}.english{font-size:13px;color:#576981}code{font-size:12px;color:#65748a}small{display:block;color:#778292;font-size:12px}
    @media(max-width:1050px){.section-container{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.section-container{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.section-container{grid-template-columns:1fr}}
  </style>
</head>
<body><main><h1>V2 组件开发目录</h1><p>${catalog.components.length} 个组件 · 中文名称 / English name / salt · 点击在新页面进入预览</p>
<div class="section-container">
${[...groups].map(([type, items]) => `<dl>\n<dt>${escape(type)}</dt>\n${items.join('\n')}\n</dl>`).join('\n')}
</div></main></body></html>\n`;
  await writeFile(join(root, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  await writeFile(join(root, 'index.html'), html);
  console.log(`Index: ${catalog.components.length} components in ${groups.size} groups`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildIndex(process.argv[2] || 'section');
