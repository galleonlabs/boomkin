const base = new URL('../', import.meta.url);
const byId = id => document.getElementById(id);
const arrow = '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let toastTimer;
export function toast(message) {
  const node = byId('toast');
  if (!node) return;
  node.textContent = message; node.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2500);
}
document.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest('.copy') : null;
  if (!button || button.disabled) return;
  const target = byId(button.dataset.copyTarget);
  if (!target) return;
  const exact = button.hasAttribute('data-copy-exact');
  const label = button.querySelector('[data-copy-label]');
  button.disabled = true;
  if (label) label.textContent = 'Copying';
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
    await navigator.clipboard.writeText(exact ? target.textContent : target.textContent.trim());
    toast('Copied to clipboard');
  } catch {
    toast(`Could not copy. Select the ${exact ? 'code' : 'command'} and copy it from the page.`);
  } finally {
    button.disabled = false;
    if (label) label.textContent = 'Copy';
  }
});
document.querySelectorAll('.docs-mobile-nav select').forEach(select => select.addEventListener('change', () => { location.href = select.value; }));
const demos = {
  wallet: {question:'Find the fees, funding costs and exposure in a public Hyperliquid wallet.',heading:'See where the costs came from.',description:'Capture a bounded activity window, preserve raw source hashes and reconcile realized PnL, signed fees and funding. Partial history and unsupported markets stay visible.',evidence:[['Inputs','Public account + UTC review window'],['Account data','Official Hyperliquid public info API'],['Deliverable','Cost attribution + coverage limits']]},
  research: {question:'Resolve ETH, check the market and save the sources I can review.',heading:'Start with the asset. Keep the evidence.',description:'Resolve the CoinGecko ID, retrieve public prices and record source timestamps. Missing or stale fields stay visible.',evidence:[['Identity','ethereum · USD'],['Market data','CoinGecko public API'],['Deliverable','Timestamped evidence bundle']]},
  strategy: {question:'Test a moving-average rule against buy-and-hold, including trading costs.',heading:'A thesis deserves a test.',description:'Run the local daily spot engine with prior-observation signals, next-observation fills, fixed fees and adverse slippage. Inspect flow-neutral returns and drawdown.',evidence:[['Inputs','Dated prices + strategy rules'],['Execution model','Next observation · long-only spot'],['Deliverable','Trade log + same-flow benchmark']]},
};
const tabs = [...document.querySelectorAll('[data-demo]')];
function chooseDemo(tab) {
  const demo = demos[tab.dataset.demo];
  if (!demo) return;
  tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
  byId('desk-panel').setAttribute('aria-labelledby',tab.id);
  byId('demo-question').textContent=demo.question; byId('demo-heading').textContent=demo.heading; byId('demo-description').textContent=demo.description;
  byId('demo-evidence').innerHTML=demo.evidence.map(([label,value])=>`<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
  byId('demo-command').textContent='boomkin desk';
}
tabs.forEach((tab,index) => {
  tab.addEventListener('click',()=>chooseDemo(tab));
  tab.addEventListener('keydown',event=>{
    let target;
    if(event.key==='ArrowRight') target=tabs[(index+1)%tabs.length];
    if(event.key==='ArrowLeft') target=tabs[(index-1+tabs.length)%tabs.length];
    if(event.key==='Home') target=tabs[0]; if(event.key==='End') target=tabs.at(-1);
    if(target){event.preventDefault();chooseDemo(target);target.focus();}
  });
});
const packNames = {'defi-agent-skills':'Agent plans','defi-prediction-skills':'Prediction markets','lp-skills':'Liquidity','hyperliquid-skills':'Hyperliquid','defi-data-skills':'Market data','defi-infra-skills':'Infrastructure','defi-lending-skills':'Lending','defi-staking-skills':'Staking','defi-yield-skills':'Yield','defi-tokenized-assets-skills':'Tokenized assets','defi-routing-skills':'Swaps & bridges','defi-derivatives-skills':'Derivatives','defi-portfolio-skills':'Portfolio','defi-security-skills':'Security','defi-payments-skills':'Payments','defi-governance-skills':'Governance','defi-strategy-skills':'Strategy testing'};
export function filterWorkflows(workflows, query) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return workflows.filter(item => {
    const text = `${item.id} ${item.protocol} ${item.title} ${item.skill} ${item.output}`.toLowerCase();
    return terms.every(term => text.includes(term));
  });
}
export function initialWorkflowId(workflows, search) {
  const requested = new URLSearchParams(search).get('workflow');
  return workflows.find(item => item.id === requested)?.id ?? workflows[0]?.id;
}
export function skillSource(workflow, packs) {
  const pack = packs.find(item => item.id === workflow.pack && item.skills.includes(workflow.skill));
  if (!pack) throw new Error(`Workflow has no reviewed skill: ${workflow.id}`);
  return `https://github.com/${pack.source}/blob/${pack.revision}/${pack.path}/skills/${workflow.skill}/SKILL.md`;
}
async function initCatalog() {
  if (!byId('workflow-list') && !byId('pack-grid')) return;
  try {
    const response = await fetch(new URL('assets/catalog.json',base));
    if(!response.ok) throw new Error('catalog_unavailable');
    const data = await response.json();
    let activeId=initialWorkflowId(data.workflows,location.search);
    const detail=byId('workflow-detail');
    function showDetail(workflow) {
      activeId=workflow.id;
      document.querySelectorAll('[data-workflow]').forEach(row=>row.setAttribute('aria-pressed',String(row.dataset.workflow===activeId)));
      const source=skillSource(workflow,data.packs);
      const permalink=new URL(base);
      permalink.searchParams.set('workflow',workflow.id);
      permalink.hash='workflows';
      detail.innerHTML=`<p class="detail-protocol">${escape(workflow.protocol)}</p><h3 id="workflow-heading">${escape(workflow.title)}</h3><p>${escape(workflow.output)}</p>
        <p class="detail-skill">Skill: <a href="${escape(source)}"><code>${escape(workflow.skill)}</code></a></p>
        <h4>What you bring</h4><ul>${workflow.inputs.map(input=>`<li>${escape(input)}</li>`).join('')}</ul>
        <h4>Prepare in Boomkin</h4><div class="desk-command"><code id="workflow-command">boomkin onboard --workflow ${escape(workflow.id)}</code><button class="copy icon-button" aria-label="Copy installation command" data-copy-target="workflow-command"><svg aria-hidden="true" viewBox="0 0 20 20"><rect x="7" y="7" width="9" height="10" rx="1.5"/><path d="M12 7V3H3v9h4"/></svg></button></div>
        <details class="skill-install"><summary>Use in an agent you already have</summary><div class="desk-command"><code id="skill-command">npx skills add galleonlabs/crypto-defi-skills --skill ${escape(workflow.skill)}</code><button class="copy icon-button" aria-label="Copy skill install command" data-copy-target="skill-command"><svg aria-hidden="true" viewBox="0 0 20 20"><rect x="7" y="7" width="9" height="10" rx="1.5"/><path d="M12 7V3H3v9h4"/></svg></button></div><p>Installs from the skill library’s current main branch. The skill link above shows the exact release reviewed by Boomkin.</p></details>
        <p class="detail-access">${escape(workflow.access)}</p><div class="detail-links"><a href="${new URL('docs/workflows/',base)}">Workflow guide</a><a href="${escape(permalink.href)}">Link to this workflow</a></div>`;
    }
    function renderWorkflows() {
      const matches=filterWorkflows(data.workflows,byId('workflow-search')?.value??'');
      byId('workflow-count').textContent=`${matches.length} ${matches.length===1?'workflow':'workflows'}`;
      byId('workflow-list').innerHTML=matches.length ? matches.map(item=>`<button class="workflow-row" data-workflow="${escape(item.id)}" aria-pressed="${item.id===activeId}"><span>${escape(item.protocol)}</span><strong>${escape(item.title)}</strong>${arrow}</button>`).join(''):'<p class="empty-results">No matching jobs. Try a protocol or a different search.</p>';
      byId('workflow-list').querySelectorAll('[data-workflow]').forEach(row=>row.addEventListener('click',()=>{
        showDetail(data.workflows.find(item=>item.id===row.dataset.workflow));
        if(matchMedia('(max-width:760px)').matches){detail.focus({preventScroll:true});detail.scrollIntoView({block:'nearest'});}
      }));
      if(matches.length) showDetail(matches.find(item=>item.id===activeId)??matches[0]);
      if(!matches.length){activeId=undefined;detail.innerHTML='<h3 id="workflow-heading">Find your next job</h3><p>Clear the search to explore all reviewed workflows.</p>';}
    }
    if(byId('workflow-list')){renderWorkflows();byId('workflow-search').addEventListener('input',renderWorkflows);}
    if(byId('pack-grid')){
      byId('pack-grid').innerHTML=data.packs.map(pack=>`<article class="pack"><h3>${escape(packNames[pack.id]??pack.id)}</h3><span>${escape(pack.version)}</span><p>${escape(pack.description)}</p><a href="https://github.com/${escape(pack.source)}/tree/${escape(pack.revision)}/${escape(pack.path)}">Inspect ${pack.skills.length} ${pack.skills.length===1?'skill':'skills'} and source <span aria-hidden="true">↗</span></a></article>`).join('');
      byId('pack-summary').textContent=`${data.packs.length} independent packs · ${data.packs.reduce((sum,pack)=>sum+pack.skills.length,0)} reviewed skills · MIT`;
    }
  } catch {
    if(byId('workflow-list'))byId('workflow-list').innerHTML='<p class="empty-results">The catalog could not load. <a href="'+new URL('docs/workflows/',base)+'">Read the workflow guide</a> or reload this page.</p>';
    if(byId('pack-grid'))byId('pack-grid').innerHTML='<p>Open the <a href="https://github.com/galleonlabs/crypto-defi-skills">skill library on GitHub</a>.</p>';
  }
}
initCatalog();
