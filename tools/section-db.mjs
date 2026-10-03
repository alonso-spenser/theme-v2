import {execFile} from 'node:child_process';
import {connection} from './salt-exists.mjs';
/** Send SQL over stdin so large component payloads do not exceed argv limits. */
export async function databaseSql(sql) {
 const c=await connection();
 return new Promise((resolve,reject)=>{
  const child=execFile(c.binary,['-h',c.host,'-P',c.port,'-u',c.user,'--connect-timeout=5','--batch','--raw','--skip-column-names'],{env:{...process.env,MYSQL_PWD:c.password},timeout:20000,maxBuffer:32*1024*1024},(error,stdout)=>{
   if(error)reject(new Error('Database request failed; check the connection and generated SQL. Verify the record before retrying.'));
   else resolve(stdout.trim());
  });
  child.stdin.on('error',()=>{});
  child.stdin.end(sql);
 });
}
export async function executeSectionSql(sql) {
 const affected=await databaseSql(sql);
 if(affected!=='1')throw new Error('Database was not updated: target missing or duplicate component (affected rows: '+affected+').');
}
