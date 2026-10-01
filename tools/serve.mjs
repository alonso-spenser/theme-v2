import {createServer} from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=await realpath(new URL('..',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try {
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end();return;}
  let file=resolve(root,'.'+pathname);
  if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  file=await realpath(file);
  if(!file.startsWith(root+sep))throw Error('Outside root');
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT||9030),'127.0.0.1',()=>console.log(`Static DEMO: http://127.0.0.1:${process.env.PORT||9030}/section/`));
