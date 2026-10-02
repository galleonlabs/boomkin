import {resolve,join,extname} from 'node:path';
const root=resolve(import.meta.dir,'../site-dist');
const base=process.env.SITE_BASE??'/boomkin/';
const server=Bun.serve({hostname:'127.0.0.1',port:Number(process.env.SITE_PORT??4177),async fetch(request){
  const path=decodeURIComponent(new URL(request.url).pathname);
  if(path===base.slice(0,-1))return Response.redirect(new URL(base,request.url).href,308);
  if(!path.startsWith(base))return new Response('Not found',{status:404});
  let relative=path.slice(base.length);if(!extname(relative))relative=join(relative,'index.html');
  const full=resolve(root,relative);if(!full.startsWith(root+'/'))return new Response('Not found',{status:404});
  const file=Bun.file(full);if(!await file.exists())return new Response('Not found',{status:404});return new Response(file);
}});console.log(`Boomkin site: http://${server.hostname}:${server.port}${base}`);
