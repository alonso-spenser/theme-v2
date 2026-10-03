import {readFile, writeFile, access} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {buildSectionStyles} from './component-style.mjs';

const catalog=JSON.parse(await readFile('section/catalog.json','utf8'));
const results=[];
for(const component of catalog.components){
  if(component.status==='placeholder')continue;
  const dir=resolve('section',component.key);
  const errors=[];
  const html=await readFile(`${dir}/index.html`,'utf8');
  const root=html.match(/<section\b[^>]*>/)?.[0] || '';
  if(!html.includes('theme:standalone-demo'))errors.push('Missing standalone demo');
  if(!root.includes(`data-section="${component.salt}"`))errors.push('Wrong component identity');
  const classes=root.match(/class="([^"]*)"/)?.[1].split(/\s+/)||[];
  if(!classes.includes(component.salt)||!classes.some(x=>x.startsWith('section-')))errors.push('Missing root namespaces');
  if(/data-section-(id|type)=|data-runtime-version=/.test(root))errors.push('Redundant root attributes');
  if(/\bth:[\w-]+=|\{\{|\[\[\$\{/.test(html))errors.push('Unrendered template expression');
  for(const match of html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"/g)){
    if(!match[1].startsWith('.'))continue;
    try{await access(resolve(dir,match[1]));}catch{errors.push(`Missing asset ${match[1]}`);}
  }
  try {
    await buildSectionStyles(`${dir}/section.scss`);
  }catch(e){errors.push(e.message);}
  results.push({key:component.key,status:errors.length?'failed':'passed',errors,url:`http://www.theme.com/section/${component.key}/index.html`});
}
await writeFile('section/static-demo-verification.json',JSON.stringify({scope:'Static structure, asset references and Sass compilation; not exhaustive visual or interaction verification',results},null,2)+'\n');
console.log(JSON.stringify({total:results.length,passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed')},null,2));
if(results.some(x=>x.status==='failed'))process.exitCode=1;
