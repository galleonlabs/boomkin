import {cp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {marked} from 'marked';
import catalogFile from '../catalog/skills.json';
import workflowFile from '../catalog/workflows.json';
import {parseCatalog} from '../src/core.ts';
import {providerCatalog} from '../src/provider-catalog.ts';
import {createDocsCodeRenderer} from './docs-code.ts';

const root=resolve(import.meta.dir,'..'),out=join(root,'site-dist');
const base=process.env.SITE_BASE??'/boomkin/';
if(!/^\/(?:[a-z0-9-]+\/)*$/.test(base))throw new Error('SITE_BASE must be a slash-terminated static path');
const origin=(process.env.SITE_ORIGIN??'https://galleonlabs.github.io/boomkin').replace(/\/$/,'');
const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('SITE_ORIGIN must be an HTTPS public origin with optional path');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8')) as {version:string};
const esc=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const render=(html:string)=>html.replaceAll('@@BASE@@',base).replaceAll('@@ORIGIN@@',origin);
await rm(out,{recursive:true,force:true});await cp(join(root,'site'),out,{recursive:true});
const provenance=JSON.parse(await readFile(join(root,'site/vendor/provenance.json'),'utf8')) as {files:Record<string,string>};
for(const [path,expected] of Object.entries(provenance.files)){
  if(!['vendor/strategy-engine.mjs','data/synthetic-daily.json','data/bitcoin-180d.json','data/bitcoin-capture.json'].includes(path))throw new Error(`Unexpected vendored resource ${path}`);
  const actual=createHash('sha256').update(await readFile(join(out,path))).digest('hex');
  if(actual!==expected)throw new Error(`Vendored resource digest mismatch: ${path}`);
}
const catalog=parseCatalog(catalogFile);
await writeFile(join(out,'assets/catalog.json'),JSON.stringify({schemaVersion:1,release:manifest.version,revision,packs:catalog.packs,workflows:workflowFile.workflows},null,2)+'\n');
await writeFile(join(out,'assets/providers.json'),JSON.stringify({...providerCatalog,release:manifest.version,revision},null,2)+'\n');
const header=`<header class="header"><a class="wordmark" href="${base}">boomkin<span class="brand-mark" aria-hidden="true"></span></a><nav aria-label="Main navigation"><a href="${base}#workflows">Workflows</a><a href="${base}lab/">Strategy lab</a><a href="${base}docs/" aria-current="page">Docs</a><a class="nav-source" href="https://github.com/galleonlabs/boomkin">GitHub <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M4 12 12 4M4 4h8v8"/></svg></a></nav></header>`;
const footer=`<footer class="footer wrap"><a class="wordmark" href="${base}">boomkin<span class="brand-mark" aria-hidden="true"></span></a><p>Open-source tools for a desk you control.</p><div><a href="${base}docs/">Documentation</a><a href="https://github.com/galleonlabs/boomkin">GitHub</a><a href="https://github.com/galleonlabs/crypto-defi-skills">Skill library</a></div><span class="footer-credit">Built by <a href="https://github.com/galleonlabs">Galleon Labs</a> · MIT</span></footer>`;
const docs=[
 {slug:'',title:'Getting started',source:'site/docs/start.md'},
 {slug:'projects',title:'Research projects',source:'docs/PROJECTS.md'},
 {slug:'workflows',title:'Protocol workflows',source:'docs/WORKFLOWS.md'},
 {slug:'connections',title:'Connections',source:'docs/CONNECTIONS.md'},
 {slug:'providers',title:'Provider discovery',source:'docs/PROVIDERS.md'},
 {slug:'strategy',title:'Strategy testing',source:'site/docs/strategy.md'},
 {slug:'evidence',title:'Evidence and control',source:'site/docs/evidence.md'},
 {slug:'harnesses',title:'Other harnesses',source:'docs/HARNESSES.md'},
 {slug:'research',title:'Minara research',source:'docs/research/minara-2026-10-02.md'},
];
const sourceRoutes=new Map(docs.map(doc=>[resolve(root,doc.source),`${base}docs/${doc.slug?doc.slug+'/':''}`]));
for(const doc of docs){
  const source=await readFile(join(root,doc.source),'utf8');
  const renderer=new marked.Renderer();
  renderer.code=createDocsCodeRenderer();
  renderer.link=({href,title,tokens})=>{
    let destination=href;
    if(href&&!/^(?:[a-z]+:|\/|#)/i.test(href)){
      const [path,hash]=href.split('#');
      if(path?.endsWith('.md')||path?.includes('src/')||path?.includes('catalog/')||path?.includes('scripts/')){
        const absolute=resolve(dirname(join(root,doc.source)),path);
        destination=(sourceRoutes.get(absolute)??`https://github.com/galleonlabs/boomkin/blob/main/${absolute.slice(root.length+1)}`)+(hash?'#'+hash:'');
      }
    }
    return `<a href="${esc(destination??'')}"${title?` title="${esc(title)}"`:''}>${renderer.parser.parseInline(tokens)}</a>`;
  };
  renderer.heading=({tokens,depth})=>{const text=renderer.parser.parseInline(tokens);const id=text.replace(/<[^>]*>/g,'').toLowerCase().replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-');return `<h${depth} id="${id}">${text}</h${depth}>\n`;};
  const body=(await marked.parse(source,{renderer})).replace(/<table>/g,'<div class="table-scroll"><table>').replace(/<\/table>/g,'</table></div>');
  const links=docs.map(item=>`<a href="${base}docs/${item.slug?item.slug+'/':''}"${item.slug===doc.slug?' aria-current="page"':''}>${esc(item.title)}</a>`).join('');
  const select=docs.map(item=>`<option value="${base}docs/${item.slug?item.slug+'/':''}"${item.slug===doc.slug?' selected':''}>${esc(item.title)}</option>`).join('');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(doc.title)} | Boomkin docs</title><meta name="description" content="${esc(doc.title)} for Boomkin, an open-source DeFi agent on native Hermes."><meta name="theme-color" content="#111214"><link rel="canonical" href="${origin}/docs/${doc.slug?doc.slug+'/':''}"><link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}assets/style.css"><script type="module" src="${base}assets/app.js"></script></head><body class="docs-body"><a class="skip" href="#main">Skip to content</a>${header}<div class="docs-layout"><aside class="docs-sidebar"><p>Documentation</p><nav aria-label="Documentation">${links}</nav><a class="docs-source" href="https://github.com/galleonlabs/boomkin/blob/main/${doc.source}">View this source on GitHub ↗</a></aside><div><div class="docs-mobile-nav"><label for="doc-navigation">Documentation</label><select id="doc-navigation">${select}</select></div><main id="main" class="prose">${body}<div class="doc-meta">Boomkin ${manifest.version} · Built from <a href="https://github.com/galleonlabs/boomkin/commit/${revision}">${revision.slice(0,7)}</a> · <a href="https://github.com/galleonlabs/boomkin/blob/main/${doc.source}">Edit this page</a></div></main></div></div>${footer}<div class="toast" id="toast" role="status" aria-live="polite"></div></body></html>`;
  const destination=join(out,'docs',doc.slug);await mkdir(destination,{recursive:true});await writeFile(join(destination,'index.html'),html);
}
const pages=['index.html','lab/index.html','social.html'];
for(const path of pages)await writeFile(join(out,path),render(await readFile(join(out,path),'utf8')));
for(const path of await readdir(join(out,'docs')))if(path.endsWith('.md'))await rm(join(out,'docs',path));
await writeFile(join(out,'release.json'),JSON.stringify({version:manifest.version,revision,strategy:provenance},null,2)+'\n');
await writeFile(join(out,'.nojekyll'),'');
await writeFile(join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
const routes=['','lab/',...docs.map(doc=>`docs/${doc.slug?doc.slug+'/':''}`)];
await writeFile(join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(path=>`<url><loc>${origin}/${path}</loc></url>`).join('')}</urlset>\n`);
await writeFile(join(out,'llms.txt'),`# Boomkin\n\nOpen-source DeFi agent on native Hermes. Version ${manifest.version}.\n\n${docs.map(doc=>`- [${doc.title}](${origin}/docs/${doc.slug?doc.slug+'/':''})`).join('\n')}\n- [Skill catalog](${origin}/assets/catalog.json)\n- [Provider discovery catalog](${origin}/assets/providers.json)\n- [Source](https://github.com/galleonlabs/boomkin)\n- [Independent skills](https://github.com/galleonlabs/crypto-defi-skills)\n`);
console.log(`Built ${routes.length} routes: ${out}; ${catalog.packs.length} packs; ${workflowFile.workflows.length} workflows; ${revision}`);
