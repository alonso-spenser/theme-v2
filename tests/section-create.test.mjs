import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createSection} from '../tools/section-create.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
async function workspace(){
 const root=await mkdtemp(join(tmpdir(),'section-create-'));
 await mkdir(join(root,'section'));await mkdir(join(root,'js'));
 await writeFile(join(root,'section/catalog.json'),JSON.stringify({components:[]}));
 await writeFile(join(root,'js/catalog.js'),'// test');
 await writeFile(join(root,'package.json'),JSON.stringify({scripts:{existing:'keep'}}));
 return root;
}
test('creates a publish-valid V2 skeleton with homepage navigation and separate demo CSS',async()=>{
 const root=await workspace();
 try{
  // Simulate a manually deleted component whose catalogue and shortcut remain.
  await writeFile(join(root,'section/catalog.json'),JSON.stringify({components:[{key:'advantage/j1zpdd',type:'advantage',salt:'j1zpdd',fixtures:['default']}]}));
  await writeFile(join(root,'package.json'),JSON.stringify({scripts:{existing:'keep','section:advantage:j1zpdd':'node tools/build-section-css.mjs advantage/j1zpdd'}}));
  let checks=0;
  const result=await createSection({root,type:'emptyCard',zh:'空组件 <测试>',en:'Empty "card"',isTaken:async()=>++checks===1,publish:async({key,directory})=>{assert.ok(key.startsWith("emptyCard/"));await access(join(directory,"manifest.json"));}});
  assert.equal(checks,2);assert.match(result.salt,/^[a-z][a-z0-9]{5}$/);assert.match(result.salt,/\d/);
  const manifest=JSON.parse(await readFile(join(result.directory,'manifest.json'),'utf8'));
  assert.deepEqual(manifest.editor.groups,[]);assert.equal(manifest.name.en,'Empty "card"');
  assert.match(await readFile(join(root,'index.html'),'utf8'),/空组件 &lt;测试>/);
  assert.match(await readFile(join(result.directory,'section.css'),'utf8'),/section-demo-/);
  assert.doesNotMatch(await readFile(join(result.directory,'section.min.css'),'utf8'),/section-demo-/);
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));assert.equal(pkg.scripts.existing,'keep');assert.equal(pkg.scripts['section:advantage:j1zpdd'],undefined);assert.ok(pkg.scripts[`section:emptyCard:${result.salt}`]);
  const output=execFileSync(process.execPath,[join(project,'tools/build.mjs'),'--component',result.directory,'--validate-only'],{cwd:project,env:{...process.env,PATH:join(project,'node_modules/.bin')+':'+process.env.PATH},encoding:'utf8'});
  assert.match(output,/Valid: emptyCard/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('invalid arguments and unavailable database leave catalogue and package unchanged',async()=>{
 const root=await workspace();
 try{
  const before=await readFile(join(root,'section/catalog.json'),'utf8');
  await assert.rejects(createSection({root,type:'../escape',zh:'中文',en:'English'}),/type must/);
  await assert.rejects(createSection({root,type:'valid',zh:'中文',en:'English',isTaken:async()=>{throw new Error('offline');}}),/offline/);
  assert.equal(await readFile(join(root,'section/catalog.json'),'utf8'),before);
  await assert.rejects(access(join(root,'.section-create.lock')));
 }finally{await rm(root,{recursive:true,force:true});}
});
