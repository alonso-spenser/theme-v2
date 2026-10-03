import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publishCreatedSection} from './section-publish.mjs';
import {generateSalt} from './generate-salt.mjs';
import {buildSectionStyles} from './component-style.mjs';
import {buildIndex} from './build-section-index.mjs';
const json = value => JSON.stringify(value,null,2)+'\n';
const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

/** Create a V2 skeleton and update the catalogue under one local writer lock. */
export async function createSection({root,type,zh,en,isTaken,publish=publishCreatedSection}) {
  if(!/^[A-Za-z][A-Za-z0-9]{0,49}$/.test(type||'')) throw new Error('type must start with a letter and contain only letters/digits (max 50).');
  if(![zh,en].every(v=>typeof v==='string'&&v.trim()&&v.length<=200)) throw new Error('Chinese and English names are required (max 200 characters).');
  zh=zh.trim();en=en.trim();
  root=resolve(root);
  const sections=join(root,'section'),lock=join(root,'.section-create.lock');
  try{await mkdir(lock);}catch(e){if(e.code==='EEXIST')throw new Error('Another section:create is running; retry after it finishes.');throw e;}
  const snapshots=new Map();let directory;
  try{
    for(const path of ['package.json','section/catalog.json','index.html','section/index.html']) {
      try{snapshots.set(path,await readFile(join(root,path)));}catch(e){if(e.code!=='ENOENT')throw e;snapshots.set(path,null);}
    }
    const catalog=JSON.parse(snapshots.get('section/catalog.json').toString());
    const existing=new Set(catalog.components.map(c=>c.salt));
    for(const group of await readdir(sections,{withFileTypes:true})){
      if(!group.isDirectory())continue;
      for(const item of await readdir(join(sections,group.name),{withFileTypes:true})){
        if(!item.isDirectory())continue;
        existing.add(item.name);
        try{const m=JSON.parse(await readFile(join(sections,group.name,item.name,'manifest.json'),'utf8'));if(m.templateId)existing.add(m.templateId);}catch(e){if(e.code!=='ENOENT')throw e;}
      }
    }
    const salt=await generateSalt({existing,...(isTaken?{isTaken}:{})});
    const key=`${type}/${salt}`;
    await mkdir(join(sections,type),{recursive:true});
    const target=join(sections,type,salt);
    await mkdir(target);directory=target;
    await mkdir(join(directory,'fixtures'));
    const manifest={protocolVersion:2,componentKind:'section',type,templateId:salt,runtimeVersion:2,definitionVersion:1,schemaVersion:1,name:{'zh-CN':zh,en},policy:{removable:true,duplicable:true,maxInstances:0},render:{template:'section.th.html',style:'section.scss',variableStyle:'variable.th.css',script:'section.js'},editor:{groups:[]}};
    const fixture={section:{id:`demo-${salt}`,componentKind:'section',type,templateId:salt,runtimeVersion:2,settings:{},bindings:{},data:{}},site:{urlPrefix:'/',siteName:'Preview'},page:{pageType:'homePage'},params:{designMode:true},lang:{global:{}}};
    const files={
      'manifest.json':json(manifest),
      'fixtures/default.json':json(fixture),
      'section.th.html':`<section th:class="|section ${salt} section-\${section.id}|" th:data-section="\${section.templateId}">\n  <!-- Add component content here. -->\n</section>\n`,
      'section.scss':`.${salt} {\n  // Add shared production styles here.\n}\n\n@import "demo";\n`,
      '_demo.scss':`// Standalone demonstration only; excluded from section.min.css.\n.section-demo-${salt} { min-height: 120px; outline: 1px dashed #ccc; }\n`,
      'variable.th.css':'/* Add instance-specific styles scoped to section-${section.id}. */\n',
      'section.js':`(() => {\n  class Component extends fo.Section {\n    constructor(element, runtime) { super(element, runtime); }\n    destroy() { super.destroy(); }\n  }\n  fo.register('${salt}', Component);\n})();\n`,
      'index.html':`<!doctype html>\n<!-- theme:standalone-demo -->\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(zh)} · ${escape(en)}</title>\n<link rel="stylesheet" href="../../../css/base.css"><link rel="stylesheet" href="../../../css/page/base.css"><link rel="stylesheet" href="./section.css">\n<script defer src="../../../js/base.js"></script><script defer src="./section.js"></script><script defer src="../../../js/demo.js"></script>\n</head><body><section class="section ${salt} section-demo-${salt}" data-section="${salt}"></section></body></html>\n`,
    };
    for(const [name,content] of Object.entries(files))await writeFile(join(directory,name),content,{flag:'wx'});
    await buildSectionStyles(join(directory,'section.scss'));
    catalog.components.push({key,type,salt,name:zh,names:{'zh-CN':zh,en},runtimeVersion:2,status:'native-v2',fixtures:['default']});
    await writeFile(join(sections,'catalog.json'),json(catalog));
    const pkg=JSON.parse(snapshots.get('package.json').toString());
    pkg.scripts ||= {};
    pkg.scripts[`section:${type}:${salt}`]=`node tools/build-section-css.mjs ${key}`;
    await writeFile(join(root,'package.json'),json(pkg));
    await buildIndex(sections);
    await publish({salt,key,directory});
    return {salt,key,directory};
  }catch(error){
    if(error.preserveCreatedFiles)throw error;
    for(const [path,content] of snapshots){if(content===null)await rm(join(root,path),{force:true});else await writeFile(join(root,path),content);}
    if(directory)await rm(directory,{recursive:true,force:true});
    throw error;
  }finally{await rm(lock,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==5)throw new Error("Usage: npm run section:create -- type '中文名' 'English name'");
    const result=await createSection({root:fileURLToPath(new URL('../',import.meta.url)),type:process.argv[2],zh:process.argv[3],en:process.argv[4]});
    console.log(`Created section/${result.key}; homepage navigation and build shortcut updated; complete definition inserted into mall.theme_section.`);
  }catch(e){console.error(e.message);process.exitCode=1;}
}
