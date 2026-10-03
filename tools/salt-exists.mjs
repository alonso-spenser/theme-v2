import {readFile,access} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parse} from 'yaml';
const run=promisify(execFile);
async function datasource(path,required=false){
 try{return parse(await readFile(path,'utf8'))?.spring?.datasource||{};}
 catch(e){if(!required&&e.code==='ENOENT')return {};throw new Error('Cannot read database configuration.');}
}
/** Environment values override the local service config; credentials never enter argv or logs. */
export async function connection(env=process.env){
 const explicit=env.THEME_DB_USER!==undefined&&env.THEME_DB_PASSWORD!==undefined;
 let config={};
 if(!explicit){
  if(env.THEME_DB_CONFIG)config=await datasource(env.THEME_DB_CONFIG,true);
  else config={
   ...await datasource(fileURLToPath(new URL('../../mall/oga-mall-service/src/main/resources/application-dev.yml',import.meta.url))),
   ...await datasource(join(homedir(),'.config/oga-mall-service/datasource.local.yml')),
  };
 }
 const url=config.url?new URL(config.url.replace(/^jdbc:/,'')):null;
 const user=env.THEME_DB_USER??config.username,password=env.THEME_DB_PASSWORD??config.password;
 if(typeof user!=='string'||typeof password!=='string'||/\$\{/.test(user+password))throw new Error('Database credentials are not configured.');
 let binary=env.THEME_MYSQL_BIN;
 if(!binary){
  for(const candidate of ['/usr/local/mysql/bin/mysql','/opt/homebrew/opt/mysql-client/bin/mysql','/opt/homebrew/bin/mysql']){
   try{await access(candidate);binary=candidate;break;}catch{}
  }
 }
 return {binary:binary||'mysql',host:env.THEME_DB_HOST||url?.hostname||'127.0.0.1',port:env.THEME_DB_PORT||url?.port||'3306',user,password};
}
export async function saltExists(salt){
 if(!/^[A-Za-z][A-Za-z0-9]{5}$/.test(salt))throw new Error('Invalid salt');
 const c=await connection();
 const value=salt.toLowerCase();
 const query=`SELECT EXISTS(SELECT 1 FROM mall.theme_section WHERE LOWER(salt)='${value}' OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(section_schema,'$.templateId')))='${value}');`;
 const {stdout}=await run(c.binary,['-h',c.host,'-P',c.port,'-u',c.user,'--connect-timeout=5','--batch','--raw','--skip-column-names','-e',query],{env:{...process.env,MYSQL_PWD:c.password},timeout:15000});
 if(!['0','1'].includes(stdout.trim()))throw new Error('Invalid database response');
 return stdout.trim()==='1';
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(await saltExists(process.argv[2])?'1':'0');}
 catch{console.error('Database salt check failed. Check local service configuration or THEME_DB_CONFIG/THEME_DB_USER/THEME_DB_PASSWORD and MySQL access.');process.exitCode=1;}
}
