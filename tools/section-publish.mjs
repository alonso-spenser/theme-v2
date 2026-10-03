import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {connection} from './salt-exists.mjs';
import {main as generateSql} from './section-sql.mjs';
const run=promisify(execFile);
/** Insert a validated new component; never upsert an existing definition. */
export async function publishCreatedSection({key}) {
 const c=await connection();
 await generateSql([key,'--create','--dry-run']);
 const root=fileURLToPath(new URL('../',import.meta.url));
 const sql=await readFile(resolve(root,'dist/database',key,'create.sql'),'utf8');
 try {
  const {stdout}=await run(c.binary,['-h',c.host,'-P',c.port,'-u',c.user,'--connect-timeout=5','--batch','--raw','--skip-column-names','-e',sql],{env:{...process.env,MYSQL_PWD:c.password},timeout:20000,maxBuffer:1024*1024});
  if(stdout.trim()!=='1'){
   const error=new Error('Component was not inserted (duplicate identity). Generated files were retained for inspection.');
   error.preserveCreatedFiles=true;throw error;
  }
 }catch(error){
  if(error.preserveCreatedFiles)throw error;
  const safe=new Error('Database insert did not confirm success. Generated files were retained; verify theme_section before retrying.');
  safe.preserveCreatedFiles=true;throw safe;
 }
}
