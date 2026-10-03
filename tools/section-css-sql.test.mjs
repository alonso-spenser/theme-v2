import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildSectionStyles} from './component-style.mjs';
import {cssUpdateSql} from './section-css-sql.mjs';
test('SQL reads production min.css and refuses stale or demo CSS',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'css-sql-'));
 try {
  await writeFile(join(dir,'manifest.json'),JSON.stringify({type:'header',templateId:'Abc123',runtimeVersion:2}));
  await writeFile(join(dir,'section.scss'),'.Abc123 { color: blue; }\n@import "demo";\n');
  await writeFile(join(dir,'_demo.scss'),'.section-demo-Abc123 {color:red;}');
  await buildSectionStyles(join(dir,'section.scss'));
  const css=await readFile(join(dir,'section.min.css'),'utf8');
  const sql=await cssUpdateSql(dir,'header/Abc123');
  assert.ok(sql.includes(Buffer.from(css).toString('hex')));
  await writeFile(join(dir,'section.min.css'),await readFile(join(dir,'section.css')));
  await assert.rejects(cssUpdateSql(dir,'header/Abc123'),/stale or contains demo/);
  await assert.rejects(cssUpdateSql(dir,'footer/Abc123'),/identity/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
