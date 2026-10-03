import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {databaseSql, executeSectionSql} from './section-db.mjs';
import {execFileSync} from 'node:child_process';
const columns={schema:'section_schema',data:'section_data',java:'thymeleaf_template',css:'base_css','variable-css':'variable_css',script:'script_code'};
const hex=v=>v===''?"''":`CONVERT(0x${Buffer.from(v).toString('hex')} USING utf8mb4)`;
/** Reject ambiguous or unknown flags instead of silently ignoring a requested field. */
export function parseOptions(args){
 const options={create:false,dryRun:false,fields:[],group:3000};
 for(const arg of args){
  if(arg==='--create')options.create=true;
  else if(arg==='--dry-run')options.dryRun=true;
  else if(arg==='--all')options.fields=Object.keys(columns);
  else if(arg.startsWith('--group=')){options.group=Number(arg.slice(8));if(![1000,2000,3000,4000].includes(options.group))throw new Error('Invalid group');}
  else if(arg.startsWith('--')&&columns[arg.slice(2)])options.fields.push(arg.slice(2));
  else throw new Error(`Unknown option: ${arg}`);
 }
 if(options.create)options.fields=Object.keys(columns);
 if(!options.fields.length)options.fields=['css'];
 options.fields=[...new Set(options.fields)];
 if(!options.create&&args.some(a=>a.startsWith('--group=')))throw new Error('--group applies only to --create');
 return options;
}
/** Map a freshly validated publish package to only the requested database columns. */
export function sectionSql(pkg,css,key,options){
 const [type,salt]=key.split('/');
 if(pkg.identity.type!==type||pkg.identity.templateId!==salt||pkg.definition.runtimeVersion!==2)throw new Error('Package identity mismatch');
 if(css!==pkg.assets.baseCss||css.includes('.section-demo-'))throw new Error('Production CSS mismatch');
 const values={schema:JSON.stringify(pkg.definition),data:JSON.stringify(pkg.defaults),java:pkg.assets.thymeleafTemplate,css,'variable-css':pkg.assets.variableCss||'',script:pkg.assets.script};
 const code=type+'.'+salt;
 if(code.length>50)throw new Error('section_code exceeds 50 characters');
 const where=`section_code=${hex(code)} AND JSON_EXTRACT(section_schema,'$.runtimeVersion')=2`;
 let statement;
 if(options.create){
  const name=pkg.definition.name.en||pkg.definition.name['zh-CN'];
  if(!name||name.length>50)throw new Error('Database section name must contain 1–50 characters');
  const fields=['id','section_name','section_code','section_type','section_group','salt','language','state','dynamic','once',...Object.values(columns)];
  const expressions=["REPLACE(UUID(),'-','')",hex(name),hex(code),hex(type),String(options.group),hex(salt),hex('{}'),'0','1',pkg.definition.policy.maxInstances===1?'0':'1',...Object.keys(columns).map(f=>hex(values[f]))];
  statement=`INSERT INTO mall.theme_section (${fields.join(',')})\nSELECT ${expressions.join(',')}\nWHERE NOT EXISTS (SELECT 1 FROM mall.theme_section WHERE LOWER(section_code)=LOWER(${hex(code)}) OR LOWER(salt)=LOWER(${hex(salt)}) OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(section_schema,'$.templateId')))=LOWER(${hex(salt)}));`;
 }else{
  statement=`UPDATE mall.theme_section SET ${options.fields.map(f=>`${columns[f]}=${hex(values[f])}`).join(',')},salt=LEFT(REPLACE(UUID(),'-',''),10) WHERE ${where};`;
 }
 return `-- ${options.create?'Create':'Update'} ${key}; fields: ${options.fields.join(', ')}\n-- Back up first. affected_sections must be 1; 0 means missing target or duplicate create.\nSTART TRANSACTION;\n${statement}\nSELECT ROW_COUNT() AS affected_sections;\nCOMMIT;\n`;
}
export async function main(args=process.argv.slice(2)){
 const [key,...flags]=args;
 if(!/^[A-Za-z][A-Za-z0-9]*\/[A-Za-z][A-Za-z0-9_-]*$/.test(key||''))throw new Error('Usage: npm run section:sql -- type/salt [--create | --all | --schema --data --java --css --variable-css --script]');
 const options=parseOptions(flags);
 const root=fileURLToPath(new URL('../',import.meta.url)),sections=await realpath(resolve(root,'section'));
 const directory=await realpath(resolve(sections,key));
 if(!directory.startsWith(sections+sep))throw new Error('Invalid component directory');
 execFileSync(process.execPath,[resolve(root,'tools/build.mjs'),'--component',directory],{cwd:root,env:{...process.env,PATH:resolve(root,'node_modules/.bin')+':'+process.env.PATH},stdio:'inherit'});
 const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
 const dist=resolve(root,'dist',key,String(manifest.definitionVersion));
 const pkg=JSON.parse(await readFile(resolve(dist,'publish.json'),'utf8'));
 const css=await readFile(resolve(dist,'section.min.css'),'utf8');
 const sql=sectionSql(pkg,css,key,options);
 const name=options.create?'create.sql':flags.length?'update.sql':'base-css.sql';
 const output=resolve(root,'dist/database',key,name);
 await mkdir(dirname(output),{recursive:true});await writeFile(output,sql);
 if(options.dryRun){console.log(`Generated ${output}; dry run: database was not modified.`);return;}
 const code=key.replace('/', '.');
 if(!options.create){
  const backup=await databaseSql(`SELECT JSON_OBJECT('id',id,'salt',salt,${Object.values(columns).map(column=>`'${column}',${column}`).join(',')}) FROM mall.theme_section WHERE section_code=${hex(code)};`);
  if(!backup)throw new Error('Component does not exist; use --create for first publication.');
  const backupPath=resolve(dirname(output),`before-${Date.now()}.json`);
  await writeFile(backupPath,backup+'\n',{flag:'wx'});
  console.log(`Backup: ${backupPath}`);
 }
 await executeSectionSql(sql);
 console.log(`Database synchronized: ${key}; fields: ${options.fields.join(', ')}; affected rows: 1.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
