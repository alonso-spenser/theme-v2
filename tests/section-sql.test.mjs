import test from 'node:test';import assert from 'node:assert/strict';
import {parseOptions,sectionSql} from '../tools/section-sql.mjs';
const pkg={identity:{type:'advantage',templateId:'a1b2c3'},definition:{runtimeVersion:2,name:{en:'Advantage'},policy:{maxInstances:0}},defaults:{title:'Hello'},assets:{baseCss:'',thymeleafTemplate:'<section></section>',variableCss:'',script:''}};
test('selective updates only include requested fields',()=>{
 const sql=sectionSql(pkg,'','advantage/a1b2c3',parseOptions(['--schema','--java','--data']));
 assert.match(sql,/SET section_schema=/);assert.match(sql,/section_data=/);assert.match(sql,/thymeleaf_template=/);
 assert.doesNotMatch(sql,/base_css=|variable_css=|script_code=/);
 assert.throws(()=>parseOptions(['--schma']),/Unknown option/);
 assert.throws(()=>parseOptions(['--group=2000']),/only to/);
});
test('create includes all fields and prevents overwriting duplicate identity',()=>{
 const sql=sectionSql(pkg,'','advantage/a1b2c3',parseOptions(['--create']));
 for(const field of ['section_schema','section_data','thymeleaf_template','base_css','variable_css','script_code'])assert.ok(sql.includes(field));
 assert.match(sql,/WHERE NOT EXISTS/);assert.doesNotMatch(sql,/ON DUPLICATE KEY|REPLACE INTO/);
 assert.doesNotMatch(sql,/0x USING/);
});

test('database synchronization is default and dry-run is explicit',()=>{
 assert.equal(parseOptions(['--css']).dryRun,false);
 assert.equal(parseOptions(['--css','--dry-run']).dryRun,true);
});
