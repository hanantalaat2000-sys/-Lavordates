import http from 'node:http';
import { Readable } from 'node:stream';
const upstream = new URL('https://lavor-dates-boutique.arwa-usama16.chatgpt.site');
const server = http.createServer(async (req,res) => {
 try {
  const url = new URL(req.url, 'http://localhost');
  if(url.pathname === '/healthz'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ok');}
  const allowed = url.pathname === '/' || url.pathname === '/api/store' || url.pathname === '/api/media' || /^\/(images|assets|_next|favicon|robots|sitemap)(\/|\.|$)/.test(url.pathname);
  if(!allowed || url.searchParams.has('admin')){res.writeHead(404);return res.end('Not found');}
  if(!['GET','HEAD','POST'].includes(req.method) || (req.method==='POST' && url.pathname!=='/api/store')){res.writeHead(405);return res.end();}
  const publicOrigin = 'https://' + req.headers.host;
  const headers = new Headers();
  for(const key of ['accept','accept-language','content-type','range','if-none-match','if-modified-since','rsc','next-router-state-tree','next-router-prefetch']){
   if(typeof req.headers[key]==='string') headers.set(key,req.headers[key]);
  }
  let body;
  if(req.method==='POST'){
   if(req.headers.origin!==publicOrigin && !(process.env.NODE_ENV==='test' && req.headers.origin==='http://'+req.headers.host)){res.writeHead(403);return res.end();}
   const chunks=[];let bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>40000){res.writeHead(413);return res.end();}chunks.push(chunk);}
   body=Buffer.concat(chunks);
   let data;try{data=JSON.parse(body);}catch{res.writeHead(400);return res.end();}
   if(!['order','inquiry','event'].includes(data.action)){res.writeHead(403);return res.end();}
   headers.set('origin',upstream.origin);
  }
  const target = new URL(url.pathname+url.search,upstream);
  const response = await fetch(target,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(45000)});
  const out={};
  for(const [key,value] of response.headers){
   if(['content-length','content-encoding','transfer-encoding','connection','set-cookie','alt-svc'].includes(key))continue;
   out[key]=value.replaceAll(upstream.origin,publicOrigin);
  }
  if(out.location?.startsWith('/')){out.location=publicOrigin+out.location;}
  const type=response.headers.get('content-type')||'';
  if(/text\/html|text\/x-component/.test(type)){
   const text=(await response.text()).replaceAll(upstream.origin,publicOrigin);
   res.writeHead(response.status,out);return res.end(req.method==='HEAD'?undefined:text);
  }
  res.writeHead(response.status,out);
  if(req.method==='HEAD'||!response.body)return res.end();
  Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);
 } catch { if(!res.headersSent)res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});res.end('تعذر الاتصال بالموقع مؤقتًا. يرجى المحاولة مجددًا.'); }
});
server.listen(Number(process.env.PORT||10000),'0.0.0.0');
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
