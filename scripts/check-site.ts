import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {parseProviderCatalog} from '../src/provider-catalog.ts';
const root=resolve(import.meta.dir,'../site-dist'),base=process.env.SITE_BASE??'/boomkin/';
async function files(directory:string):Promise<string[]>{const items=await readdir(directory,{withFileTypes:true});return(await Promise.all(items.map(item=>item.isDirectory()?files(join(directory,item.name)):[join(directory,item.name)]))).flat();}
const pages=(await files(root)).filter(path=>path.endsWith('.html'));
let links=0;
for(const page of pages){
  const html=await readFile(page,'utf8');
  if(html.includes('@@'))throw new Error(`Unresolved template in ${page}`);
  if(!html.includes('<title>')||!html.includes('name="viewport"')||!html.includes('lang="en"'))throw new Error(`Missing page metadata in ${page}`);
  const url=new URL('https://check.local'+base+page.slice(root.length+1).replace(/index\.html$/,''));
  for(const [,value] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const target=new URL(value,url);
    if(target.origin!==url.origin)continue;
    if(!target.pathname.startsWith(base))throw new Error(`Link escapes site base: ${value} in ${page}`);
    let relative=decodeURIComponent(target.pathname.slice(base.length));
    if(!extname(relative))relative=join(relative,'index.html');
    const full=resolve(root,relative);
    if(!full.startsWith(root+'/'))throw new Error(`Unsafe site path: ${value}`);
    try{if(!(await stat(full)).isFile())throw new Error();}catch{throw new Error(`Broken internal link: ${value} in ${page}`);}
    if(target.hash&&full.endsWith('.html')){
      const destination=full===page?html:await readFile(full,'utf8');
      const id=decodeURIComponent(target.hash.slice(1));
      if(!destination.includes(`id="${id}"`))throw new Error(`Broken fragment: ${value} in ${page}`);
    }
    links++;
  }
}
const release=JSON.parse(await readFile(join(root,'release.json'),'utf8'));
if(!/^[a-f0-9]{40}$/.test(release.strategy.revision))throw new Error('Strategy vendor source must pin a released commit');
const data=JSON.parse(await readFile(join(root,'assets/catalog.json'),'utf8'));
const ids=new Set(data.packs.map((pack:{id:string})=>pack.id));
for(const workflow of data.workflows)if(!ids.has(workflow.pack))throw new Error(`Workflow has no reviewed pack: ${workflow.id}`);
const providers=parseProviderCatalog(JSON.parse(await readFile(join(root,'assets/providers.json'),'utf8')));
if(providers.providers.filter(provider=>provider.listedInDirectory).length!==58)throw new Error('Provider catalog must retain all studied directory entries');
console.log(`${pages.length} pages; ${links} local links/assets; reviewed workflow packs and strategy provenance valid`);
