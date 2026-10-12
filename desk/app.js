import {KIND_LABELS,TERMINAL_STATES,ASSETS,TEMPLATES,assetName,shortAddress,money,percent,count,dateTime,dateOnly,age,sourceName,safeExternalUrl,safeLoopbackUrl,observations,stateLabel,progressText,inferTask,metricsFor,errorMessage} from './ui.js';

const $=id=>document.getElementById(id);
const storage={get(key){try{return sessionStorage.getItem(key);}catch{return null;}},set(key,value){try{sessionStorage.setItem(key,value);}catch{}},remove(key){try{sessionStorage.removeItem(key);}catch{}}};
const launchToken=new URLSearchParams(location.hash.slice(1)).get('token');
if(launchToken){storage.set('boomkin.desk.token',launchToken);history.replaceState(null,'',location.pathname+location.search);}
let token=launchToken || storage.get('boomkin.desk.token');
let status,projects=[],selectedProject,selectedRun,detail,currentView='connection',pollTimer,toastTimer,historyFingerprint='',renderFingerprint='',setupBusy=false,requestBusy=false;
let pendingQuestion='',uploadedDataset;
let navigation=0;
let comparisonBaseline=null,comparison=null;

function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!==null)node.textContent=String(text);return node;}
function button(label,className='text-button',action){const node=el('button',className,label);node.type='button';if(action)node.addEventListener('click',action);return node;}
function link(label,url,className){const safe=safeExternalUrl(url);if(!safe)return el('span',className,label);const node=el('a',className,label);node.href=safe;node.target='_blank';node.rel='noopener noreferrer';return node;}
function append(parent,...nodes){parent.append(...nodes.filter(Boolean));return parent;}
function heading(title,description){const box=el('div','form-heading');append(box,el('span','eyebrow','Your local desk'),el('h1','',title),el('p','',description));return box;}
function back(action=()=>showDesk()){return button('← Back to the desk','text-button back-button',action);}
function announce(message){$('announcement').textContent=message;}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function errorBox(message){const box=el('div','form-error',message);box.setAttribute('role','alert');return box;}
function setConnection(connected){$('connection-dot').className=`status-dot ${connected?'connected':'failed'}`;$('connection-label').textContent=connected?'Local desk connected':'Local server unavailable';}
function closeSidebar(){ $('sidebar').classList.remove('open');$('mobile-menu').setAttribute('aria-expanded','false');$('sidebar-overlay').hidden=true; }
function showView(view,{focus=true}={}){
  const changed=currentView!==view;
  currentView=view;
  for(const name of ['connection','setup','desk','task','result','settings'])$(`${name}-view`).hidden=name!==view;
  closeSidebar();
  if(changed||focus)window.scrollTo({top:0,left:0,behavior:'instant'});
  if(focus){const node=view==='desk'?$('question'):$(`${view}-view`).querySelector('h1');if(node){if(node.tagName!=='TEXTAREA')node.tabIndex=-1;node.focus({preventScroll:true});}}
}
async function api(path,{method='GET',body,raw=false}={}){
  if(!token)throw {code:'unauthorized'};
  let response;
  try{response=await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store'});}
  catch{throw {code:'network_error'};}
  if(!response.ok){let value;try{value=await response.json();}catch{}if(response.status===401){storage.remove('boomkin.desk.token');token=null;throw {code:'unauthorized'};}throw value ?? {code:`http_${response.status}`,message:`The local server returned HTTP ${response.status}.`};}
  if(raw)return response;
  return response.json();
}
function capability(kind){return status?.capabilities?.find(item=>item.kind===kind);}
function profileReady(){return !!(status?.profile?.runtimeAvailable&&status?.profile?.modelConfigured);}
async function loadStatus(){status=await api('/api/status');setConnection(true);return status;}
async function loadProjects(){const value=await api('/api/projects');projects=Array.isArray(value.projects)?value.projects:[];renderHistory();return projects;}
function newestRun(project){return project?.runs?.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];}
function projectTitle(project){return project.title ?? (project.kind==='wallet'?`Wallet ${shortAddress(project.inputs?.account)}`:project.kind==='strategy'?`${assetName(project.inputs?.asset)} strategy`:assetName(project.inputs?.asset));}
function renderHistory(){
  const sorted=projects.slice().sort((a,b)=>String(newestRun(b)?.createdAt ?? b.createdAt).localeCompare(String(newestRun(a)?.createdAt ?? a.createdAt)));
  const fingerprint=JSON.stringify(sorted.map(item=>({name:item.name,title:projectTitle(item),kind:item.kind,run:newestRun(item)?.id,state:newestRun(item)?.state,selected:item.name===selectedProject?.name})));
  if(fingerprint===historyFingerprint)return;historyFingerprint=fingerprint;
  const list=$('history-list'),fragment=document.createDocumentFragment();$('research-count').textContent=sorted.length?String(sorted.length):'';
  for(const project of sorted){
    const run=newestRun(project),item=button('','history-item',()=>openProject(project.name));item.setAttribute('aria-current',String(project.name===selectedProject?.name));item.title=projectTitle(project);
    const meta=el('span','history-meta');append(meta,el('span',`history-dot ${run?.state ?? ''}`),el('span','',`${KIND_LABELS[project.kind] ?? 'Research'} · ${run?stateLabel(run.state):'Saved'}`));
    append(item,el('strong','',projectTitle(project)),meta);fragment.append(item);
  }
  if(!sorted.length)fragment.append(el('p','history-empty','Your research will appear here.'));
  list.replaceChildren(fragment);
}
function showDesk(){navigation++;selectedProject=null;selectedRun=null;detail=null;renderFingerprint='';renderHistory();showView('desk');schedulePoll();}
function newResearch(){pendingQuestion='';$('question').value='';showDesk();}

function readinessRow(title,description,label,mode='ready'){
  const row=el('div','readiness-row'),icon=el('span',`readiness-icon ${mode==='ready'?'':mode}`,mode==='ready'?'✓':mode==='warning'?'!':'·');icon.setAttribute('aria-hidden','true');
  append(row,icon,append(el('div','readiness-copy'),el('strong','',title),el('p','',description)),el('span',`readiness-label ${mode==='ready'?'':'pending'}`,label));return row;
}
function modelSetupLink(){const raw=status?.setup?.url ?? status?.setup?.result?.url ?? status?.setup?.result?.dashboardUrl;return safeLoopbackUrl(raw);}
function renderSetup({focus=false}={}){
  const view=$('setup-view'),toolsReady=status?.capabilities?.every(item=>item.ready),available=status?.capabilities?.filter(item=>item.ready).length ?? 0;
  const title=toolsReady?'Your desk is ready.':'Prepare your desk.';
  const intro=toolsReady?'Start with public data and documented rules. Add your model when you want a deeper conversation.':'Prepare the reviewed public research tools. Boomkin keeps captures and results in your local workspace.';
  view.replaceChildren();
  append(view,el('span','eyebrow','A desk you control'),el('h1','',title),el('p','setup-intro',intro));
  const list=el('div','readiness-list');
  append(list,readinessRow('Public research tools',toolsReady?'Market snapshots, Hyperliquid wallet accounting and historical strategy tests.':(status?.capabilities?.flatMap(item=>item.issues ?? []).join(' ') || 'Prepare the reviewed helper packs for these three jobs.'),toolsReady?'Ready':'Needs setup',toolsReady?'ready':'warning'));
  append(list,readinessRow('Research saved locally','Questions, captured sources and run history stay in this Boomkin workspace.','On this computer'));
  append(list,readinessRow('Native model configuration',status?.profile?.runtimeChecking?'Checking native runtime availability in the background. Public research is ready independently.':profileReady()?'A model is configured in Hermes. Hermes checks sign-in when it runs.':'Optional for the first three jobs. Sign in through the native Hermes setup when you need agent research.',status?.profile?.runtimeChecking?'Checking':profileReady()?'Configured':'Optional',profileReady()?'ready':'pending'));
  view.append(list);
  if(status?.setup?.state==='running'){view.append(el('div','setup-progress',status.setup.message || 'Preparing the reviewed research tools…'));}
  if(status?.setup?.state==='failed'){view.append(errorBox(errorMessage(status.setup)));}
  const actions=el('div','setup-actions');
  if(!toolsReady){const install=button('Prepare public tools','button primary',startPublicSetup);install.disabled=status?.setup?.state==='running'||setupBusy;actions.append(install);}
  const enter=button('Open your desk','button '+(toolsReady?'primary':'subtle'),()=>{storage.set('boomkin.desk.welcome','seen');showDesk();});enter.disabled=!available;actions.append(enter);
  if(toolsReady&&!profileReady())actions.append(button('Connect a model later','text-button',showSettings));
  view.append(actions);
  append(view,el('p','setup-note','These first jobs use public data without a model call. Model use happens through native Hermes and your chosen provider.'));
  if(modelSetupLink())append(view,link('Open Hermes sign-in ↗',modelSetupLink(),'button subtle'));
  showView('setup',{focus});
}
async function startPublicSetup(){
  setupBusy=true;let failure;
  const previous=status?.setup;status={...status,setup:{state:'running',action:'public-tools',message:'Preparing the reviewed public research tools…'}};renderSetup();
  try{await api('/api/setup',{method:'POST'});await loadStatus();renderSetup();schedulePoll(900);}
  catch(error){status={...status,setup:previous};failure=error;}
  finally{setupBusy=false;renderSetup();if(failure)$('setup-view').append(errorBox(errorMessage(failure)));}
}
function showSettings(){
  navigation++;
  showView('settings',{focus:false});renderSettings();schedulePoll();
}
function renderSettings(){
  const view=$('settings-view');view.replaceChildren();append(view,back(),heading('Your workspace.','Keep the research simple. Add native agent capabilities when you need them.'));
  const tools=el('section','settings-section');append(tools,el('h2','','Public research tools'),el('p','',status?.capabilities?.every(item=>item.ready)?'The three data and simulation jobs are ready in this profile. They do not require a model call.':'Some reviewed research tools need preparation before their jobs can run.'));
  const facts=el('div','settings-facts');for(const item of status?.capabilities ?? [])append(facts,append(el('div'),el('span','',KIND_LABELS[item.kind] ?? item.kind),el('strong','',item.ready?'Ready':(item.issues ?? []).join(' ') || 'Needs setup')));tools.append(facts);
  if(status?.capabilities?.some(item=>!item.ready))tools.append(button('Prepare public tools','button subtle',async()=>{renderSetup();await startPublicSetup();}));
  view.append(tools);
  const model=el('section','settings-section');append(model,el('h2','','Your model, through Hermes'),el('p','','Connect a model for deeper questions about saved evidence. Sign-in stays in the official Hermes interface; Boomkin does not collect provider keys.'));
  const modelFacts=el('div','settings-facts');append(modelFacts,append(el('div'),el('span','','Native Hermes'),el('strong','',status?.profile?.runtimeChecking?'Checking availability':status?.profile?.runtimeAvailable?'Available':'Needs setup')),append(el('div'),el('span','','Model configuration'),el('strong','',status?.profile?.modelConfigured?'Configured':'Not configured')),append(el('div'),el('span','','Sign-in'),el('strong','','Checked by Hermes when it runs')));model.append(modelFacts);
  if(status?.setup?.state==='running')model.append(el('div','setup-progress',status.setup.message || 'Opening native model setup…'));
  else if(modelSetupLink()){append(model,link('Open Hermes sign-in ↗',modelSetupLink(),'button primary'),button('Prepare native setup again','text-button',startModelSetup),el('p','model-note','Complete authentication in Hermes, then choose a model in its Models page. Return here and check the connection.'));}
  else {const connect=button(status?.profile?.modelConfigured?'Open native model setup':'Connect a model','button subtle',startModelSetup);connect.disabled=setupBusy;model.append(connect);}
  model.append(button('Check connection','text-button',async()=>{try{await loadStatus();renderSettings();toast('Native configuration checked. Hermes verifies sign-in when it runs.');}catch(error){model.append(errorBox(errorMessage(error)));}}));
  if(status?.setup?.state==='failed')model.append(errorBox(errorMessage(status.setup)));
  append(model,el('p','model-note','Native agent runs may incur charges from your chosen model and connected tools. Public data jobs remain available without them.'),link('Native setup and recovery guide','https://galleonlabs.github.io/boomkin/docs/setup/'));
  view.append(model);
  const local=el('section','settings-section');append(local,el('h2','','Local by default'),el('p','','The desk listens on loopback and uses this session’s authorization token. There is no telemetry. Public source requests leave your computer to retrieve the data you ask for. Saved exports can contain public wallet activity.'));
  append(local,el('p','model-note','Keep the terminal that runs “boomkin desk” open. Closing that process stops the desk and its owned native setup server.'));
  view.append(local);
  showView('settings',{focus:false});
}
async function startModelSetup(){
  setupBusy=true;let failure;
  const previous=status?.setup;status={...status,setup:{state:'running',action:'model',message:'Preparing the native Hermes sign-in interface…'}};renderSettings();
  try{await api('/api/model-setup',{method:'POST'});await loadStatus();renderSettings();schedulePoll(900);}
  catch(error){status={...status,setup:previous};failure=error;}
  finally{setupBusy=false;renderSettings();if(failure)$('settings-view').append(errorBox(errorMessage(failure)));}
}

function field(label,{type='text',name,value,required=false,min,max,step,placeholder,options,description,accept}={}){
  const wrapper=el('label','field');wrapper.append(el('span','',label));let input;
  if(options){input=el('select');for(const item of options){const option=el('option','',item.label);option.value=item.value;input.append(option);}}
  else input=el('input');
  if(!options)input.type=type;
  if(name){input.name=name;input.id=`input-${name}`;}
  if(value!==undefined)input.value=value;
  if(required)input.required=true;
  if(min!==undefined)input.min=String(min);if(max!==undefined)input.max=String(max);if(step!==undefined)input.step=String(step);
  if(placeholder)input.placeholder=placeholder;if(accept)input.accept=accept;
  wrapper.append(input);if(description)wrapper.append(el('span','field-note',description));return {wrapper,input};
}
function assetField({value='ethereum',name='asset'}={}){
  const control=field('Asset',{name,value,required:true,placeholder:'For example, ethereum',description:'Exact CoinGecko identity. Tickers can refer to more than one asset.'});control.input.pattern='[a-z0-9][a-z0-9-]{0,99}';control.input.maxLength=100;control.input.autocomplete='off';control.input.setAttribute('list','asset-options');
  const list=el('datalist');list.id='asset-options';for(const asset of ASSETS){const option=el('option','',`${asset.name} · ${asset.symbol}`);option.value=asset.id;list.append(option);}control.wrapper.append(list);return control;
}
function showTask(kind,prefill={}){
  navigation++;
  selectedProject=null;selectedRun=null;detail=null;renderHistory();uploadedDataset=undefined;
  const view=$('task-view');view.replaceChildren();view.append(back());
  const titles={market:'Research an asset.',wallet:'Understand the wallet.',strategy:'Put the rule to the test.'};
  const descriptions={market:'Capture fresh public USD marks and compare their timestamps. Keep the exact asset identity and source responses.',wallet:'Review a public Hyperliquid account’s observed fees, funding and current exposure. Start with an address and a UTC date range.',strategy:'Choose one documented daily spot rule. Test separate chronological periods at baseline and higher trading costs.'};
  view.append(heading(titles[kind],descriptions[kind]));
  if(pendingQuestion)view.append(el('div','info-note',`Your question: ${pendingQuestion}`));
  const form=el('form','task-form');form.id='task-input-form';
  if(capability(kind)?.ready===false){const note=el('div','info-note');append(note,el('p','',capability(kind).issues?.join(' ') || 'Prepare the public research tools to start this job.'),button('Prepare the tools','text-button',()=>renderSetup({focus:true})));form.append(note);}
  if(kind==='market'){
    const asset=assetField({value:prefill.asset ?? (pendingQuestion?'':'ethereum')});form.append(asset.wrapper);
    const presets=el('div','preset-row');for(const item of ASSETS){const preset=button(`${item.name} · ${item.symbol}`,'preset',()=>{asset.input.value=item.id;for(const sibling of presets.children)sibling.setAttribute('aria-pressed',String(sibling===preset));});preset.setAttribute('aria-pressed',String(asset.input.value===item.id));presets.append(preset);}form.append(presets);
    form.append(el('p','input-note','This first result is a market snapshot. Broader explanation can use the captured evidence through your native agent.'));
  }else if(kind==='wallet'){
    const account=field('Public account address',{name:'account',value:prefill.account ?? '',required:true,placeholder:'0x…',description:'The account to inspect. This does not connect a wallet or establish ownership.'});account.input.pattern='0x[0-9a-fA-F]{40}';account.input.maxLength=42;account.input.autocomplete='off';form.append(account.wrapper);
    const now=new Date(),end=now.toISOString().slice(0,10),start=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
    const dates=el('div','form-row');append(dates,field('From (UTC)',{type:'date',name:'start',value:start,required:true,max:end}).wrapper,field('Through (UTC)',{type:'date',name:'end',value:end,required:true,max:end,description:'Today ends at capture time.'}).wrapper);form.append(dates);
    const advanced=el('details','advanced');advanced.append(el('summary','','Capture settings'));const contents=el('div');append(contents,field('Network',{name:'network',value:'mainnet',options:[{value:'mainnet',label:'Hyperliquid mainnet'},{value:'testnet',label:'Hyperliquid testnet'}]}).wrapper,field('History page limit',{type:'number',name:'maxPages',value:3,min:1,max:50,step:1,required:true,description:'Bounded requests per history feed. A page limit can leave partial history.'}).wrapper);advanced.append(contents);form.append(advanced);
    const example=el('div','preset-row');example.append(button('Try a public vault','preset',()=>{account.input.value='0x010461c14e146ac35fe42271bdc1134ee31c703a';form.elements.start.value=new Date(Date.now()-86400000).toISOString().slice(0,10);form.elements.end.value=new Date().toISOString().slice(0,10);form.elements.maxPages.value='1';toast('HLP Strategy A · public example vault · one-page history budget.');}));example.append(link('HLP Strategy A ↗','https://app.hyperliquid.xyz/vaults/0x010461c14e146ac35fe42271bdc1134ee31c703a','text-button'));form.append(example);
    form.append(el('div','info-note','The result covers captured validator-operated perpetual activity. It cannot establish complete portfolio profit, historical return or stop protection.'));
  }else{
    const dataset=field('Price data',{name:'datasetSource',value:'bundled',options:[{value:'bundled',label:'Bitcoin · dated 180-day series'},{value:'live',label:'Capture a fresh daily series'},{value:'upload',label:'Use your daily dataset'}]});form.append(dataset.wrapper);
    const dataNote=el('p','input-note','Historical Bitcoin marks captured on 2 October 2026. The source timestamp remains attached to every result.');dataNote.id='strategy-data-note';form.append(dataNote);
    const asset=assetField({value:'bitcoin'});asset.wrapper.hidden=true;asset.input.disabled=true;form.append(asset.wrapper);
    const upload=field('Daily USD dataset (up to 256 KiB)',{type:'file',name:'dataset',accept:'.json,application/json',description:'Documented JSON format with exact identity, daily prices and source provenance.'});upload.wrapper.hidden=true;upload.input.disabled=true;const fileStatus=el('p','file-status');upload.wrapper.append(fileStatus);form.append(upload.wrapper);
    upload.input.addEventListener('change',async()=>{
      uploadedDataset=undefined;const file=upload.input.files?.[0];fileStatus.textContent='';if(!file)return;
      if(file.size>262144){fileStatus.textContent='This file exceeds 256 KiB. Use a shorter daily series.';upload.input.setCustomValidity('The dataset exceeds 256 KiB.');return;}
      try{const parsed=JSON.parse(await file.text());uploadedDataset=parsed?.ok===true&&parsed.dataset?parsed.dataset:parsed;upload.input.setCustomValidity('');fileStatus.textContent=`${uploadedDataset.identity?.namespace ?? 'Unknown namespace'}:${uploadedDataset.identity?.id ?? 'Unknown asset'} · ${uploadedDataset.candles?.length ?? 0} observations · ${uploadedDataset.provenance?.synthetic?'Synthetic prices':'Declared historical data'} · retrieved ${dateTime(uploadedDataset.provenance?.retrievedAt)}. Validated when run.`;}
      catch{upload.input.setCustomValidity('Use valid JSON in the documented daily dataset format.');fileStatus.textContent='This file is not valid JSON. Check the dataset guide and try again.';}
    });
    dataset.input.addEventListener('change',()=>{
      const mode=dataset.input.value;asset.wrapper.hidden=mode!=='live';asset.input.disabled=mode!=='live';upload.wrapper.hidden=mode!=='upload';upload.input.disabled=mode!=='upload';upload.input.required=mode==='upload';
      dataNote.textContent=mode==='live'?'Public daily USD aggregate marks for this exact asset. A source error stays visible; Boomkin does not substitute example prices.':mode==='upload'?'The dataset you select is saved with the local research. Its supplied provenance stays visible; uploading is not independent source verification.':'Historical Bitcoin marks captured on 2 October 2026. The source timestamp remains attached to every result.';
    });
    const template=field('Documented rule',{name:'template',value:prefill.template ?? 'sma-10',options:TEMPLATES.map(item=>({value:item.id,label:item.label}))});form.append(template.wrapper);
    const templateNote=el('p','input-note',TEMPLATES.find(item=>item.id===template.input.value)?.description);form.append(templateNote);
    const dca=field('Budget per weekly buy (USD)',{type:'number',name:'amountUsd',value:1000,min:.01,max:1000000000,step:.01,required:true,description:'Uses the declared initial cash. This does not schedule real buys.'});dca.wrapper.hidden=template.input.value!=='weekly-dca';dca.input.disabled=template.input.value!=='weekly-dca';form.append(dca.wrapper);
    template.input.addEventListener('change',()=>{templateNote.textContent=TEMPLATES.find(item=>item.id===template.input.value)?.description;dca.wrapper.hidden=template.input.value!=='weekly-dca';dca.input.disabled=template.input.value!=='weekly-dca';});
    form.append(field('Starting cash per period (USD)',{type:'number',name:'initialCashUsd',value:10000,min:.01,max:1000000000,step:.01,required:true}).wrapper);
    const advanced=el('details','advanced');advanced.append(el('summary','','Costs and data settings'));const contents=el('div'),row=el('div','form-row');append(row,field('Fee (basis points)',{type:'number',name:'feeBps',value:10,min:0,max:999,step:1,required:true}).wrapper,field('Slippage (basis points)',{type:'number',name:'slippageBps',value:5,min:0,max:999,step:1,required:true}).wrapper);contents.append(row);append(contents,el('p','input-note','10 basis points = 0.10%. Each period also runs at higher fixed trading costs.'),field('Days for a fresh capture',{type:'number',name:'days',value:180,min:91,max:365,step:1,required:true,description:'Applied only when capturing a fresh series.'}).wrapper,link('Dataset format and simulation methodology','https://galleonlabs.github.io/boomkin/docs/strategy/','text-button'));advanced.append(contents);form.append(advanced);
    form.append(el('div','info-note','A historical simulation, with independently restarted reference and held-out periods. It excludes leverage, funding, venue depth and intraday stops.'));
  }
  const formError=el('div');formError.id='task-error';formError.setAttribute('aria-live','polite');form.append(formError);
  const actions=el('div','form-actions'),submit=el('button','button primary',kind==='wallet'?'Review the wallet':kind==='strategy'?'Test the frozen rule':'Capture the snapshot');submit.type='submit';submit.disabled=capability(kind)?.ready===false;
  append(actions,submit,el('span','',kind==='strategy'?'Saved locally with the rule, data and assumptions.':'Read-only public requests. Sources and coverage remain visible.'));form.append(actions);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(requestBusy)return;formError.replaceChildren();if(!form.reportValidity())return;
    const values=new FormData(form),inputs={};
    if(kind==='market')inputs.asset=String(values.get('asset')).trim();
    else if(kind==='wallet'){
      const now=Date.now(),start=Date.parse(`${values.get('start')}T00:00:00.000Z`),end=Math.min(Date.parse(`${values.get('end')}T23:59:59.999Z`),now);
      if(start>=end){formError.append(errorBox('Choose a start date before the end of the capture window.'));return;}
      Object.assign(inputs,{account:String(values.get('account')).trim(),startTime:new Date(start).toISOString(),endTime:new Date(end).toISOString(),network:values.get('network'),maxPages:Number(values.get('maxPages'))});
    }else{
      Object.assign(inputs,{asset:values.get('asset') ?? 'bitcoin',days:Number(values.get('days')),template:values.get('template'),initialCashUsd:Number(values.get('initialCashUsd')),feeBps:Number(values.get('feeBps')),slippageBps:Number(values.get('slippageBps')),datasetSource:values.get('datasetSource')});
      if(inputs.template==='weekly-dca')inputs.amountUsd=Number(values.get('amountUsd'));
      if(inputs.datasetSource==='upload'){if(!uploadedDataset){formError.append(errorBox('Choose a valid daily dataset file before running the test.'));return;}inputs.dataset=uploadedDataset;inputs.asset=uploadedDataset.identity?.id ?? 'uploaded';}
    }
    requestBusy=true;submit.disabled=true;const previous=submit.textContent,requestedNavigation=navigation;submit.textContent='Preparing…';let createdProject;
    try{const created=await api('/api/projects',{method:'POST',body:{kind,inputs,...(pendingQuestion?{title:pendingQuestion.slice(0,160)}:{})}});createdProject=created.project;const started=await api(`/api/projects/${encodeURIComponent(createdProject.name)}/run`,{method:'POST'});await loadProjects();if(requestedNavigation===navigation){pendingQuestion='';await openProject(createdProject.name,started.run.id);}announce('Research started. Captured sources and progress will appear here.');}
    catch(error){if(requestedNavigation===navigation)formError.append(errorBox(errorMessage(error)));else toast(errorMessage(error));if(createdProject)await loadProjects().catch(()=>{});}
    finally{requestBusy=false;submit.disabled=capability(kind)?.ready===false;submit.textContent=previous;if(currentView==='result')renderResult(true);}
  });
  view.append(form);showView('task');const first=form.querySelector('input:not([disabled]),select:not([disabled])');first?.focus({preventScroll:true});schedulePoll();
}

async function openProject(name,runId){
  const requestedNavigation=++navigation;
  try{
    const captured=await api(`/api/projects/${encodeURIComponent(name)}`);if(requestedNavigation!==navigation)return;
    const project=captured.project,run=runId?project.runs?.find(item=>item.id===runId):newestRun(project);
    let capturedDetail;if(run){capturedDetail=await api(`/api/projects/${encodeURIComponent(name)}/runs/${encodeURIComponent(run.id)}`);if(requestedNavigation!==navigation)return;}
    selectedProject=project;selectedRun=capturedDetail?.run ?? run;detail=capturedDetail;renderFingerprint='';comparisonBaseline=null;comparison=null;
    if(!selectedRun){renderSavedProject();}else renderResult(true);
    renderHistory();showView('result');schedulePoll();
  }catch(error){if(requestedNavigation===navigation)toast(errorMessage(error));}
}
function renderSavedProject(){
  const view=$('result-view');view.replaceChildren();append(view,back(),heading(projectTitle(selectedProject),'This research is saved and has not captured a run yet.'),button('Start the research','button primary',()=>refreshRun(false)));showView('result');
}
function runPath(suffix=''){return `/api/projects/${encodeURIComponent(selectedProject.name)}/runs/${encodeURIComponent(selectedRun.id)}${suffix}`;}
function renderResult(force=false){
  if(!selectedProject||!selectedRun)return;
  const fingerprint=JSON.stringify({project:selectedProject.name,run:selectedRun.id,state:selectedRun.state,progress:selectedRun.progress,finished:selectedRun.finishedAt,integrity:detail?.integrity});
  if(!force&&fingerprint===renderFingerprint)return;renderFingerprint=fingerprint;
  const view=$('result-view'),project=selectedProject,run=selectedRun,result=detail?.result;view.replaceChildren();
  const native=run.execution==='native-hermes';
  const line=el('div','result-topline');append(line,el('span','eyebrow',`${native?'Native Hermes research':KIND_LABELS[project.kind] ?? 'Research'} · saved locally`),el('span',`result-status ${run.state}`,stateLabel(run.state)));view.append(line);
  const title=project.title ?? (project.kind==='wallet'?'Your observed wallet costs.':project.kind==='strategy'?`${assetName(result?.identity?.id ?? project.inputs?.asset)} · frozen rule test.`:`${assetName(project.inputs?.asset)} market snapshot.`);view.append(el('h1','',title));
  const identity=el('p','result-identity');
  if(project.kind==='wallet')append(identity,el('code','',result?.scope?.address ?? project.inputs?.account),document.createTextNode(` · ${result?.scope?.network ?? project.inputs?.network ?? 'mainnet'} · ${dateOnly(project.inputs?.startTime)} to ${dateOnly(project.inputs?.endTime)} (UTC)`));
  else if(project.kind==='strategy')identity.textContent=`${result?.identity?.namespace ?? (project.inputs?.datasetSource==='upload'?'supplied':'coingecko')}:${result?.identity?.id ?? project.inputs?.asset} · ${TEMPLATES.find(item=>item.id===project.inputs?.template)?.label ?? project.inputs?.template} · daily USD spot simulation`;
  else identity.textContent=`coingecko:${project.inputs?.asset} · USD aggregate marks · exact identity`;
  view.append(identity);view.append(el('p','result-date',`${run.finishedAt?'Saved':'Started'} ${dateTime(run.finishedAt ?? run.createdAt)}`));
  if(project.parent)view.append(button('Open the capture behind this follow-up','text-button parent-capture',()=>openProject(project.parent.project,project.parent.runId)));
  const active=!TERMINAL_STATES.includes(run.state);
  if(active){renderProgress(view,run,project);return;}
  const actions=el('div','result-actions');const refresh=button(run.state==='failed'||run.state==='cancelled'||run.state==='interrupted'?'Try a new capture':'Refresh research','button subtle',()=>refreshRun(true));refresh.disabled=requestBusy;actions.append(refresh);
  if(result||observations(detail?.evidence).length)actions.append(button('Export evidence','text-button',exportResult));actions.append(button('New research','text-button',newResearch));
  if((project.runs?.length ?? 0)>1){const label=el('label','result-run-select');append(label,el('span','','Saved runs'));const select=el('select');select.setAttribute('aria-label','Choose a saved run');const ordered=project.runs.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));for(const [index,item] of ordered.entries()){const option=el('option','',`${ordered.length-index} · ${dateTime(item.createdAt)} · ${stateLabel(item.state)}`);option.value=item.id;select.append(option);}select.value=run.id;select.addEventListener('change',()=>openProject(project.name,select.value));label.append(select);actions.append(label);}
  if(['failed','interrupted','cancelled'].includes(run.state)){
    const messages={failed:errorMessage(run.error ?? 'This capture did not finish. Any saved source responses are preserved.'),interrupted:'The server stopped during this capture. Saved responses are preserved; start a new capture for current evidence.',cancelled:'You cancelled this capture. Saved source responses are preserved; a new capture starts with fresh reads.'};
    const notice=el('div','result-notice '+(run.state==='cancelled'?'':'error'),messages[run.state]);notice.setAttribute('role','status');view.append(notice);view.append(actions);renderSources(view,detail);append(view,el('p','result-footer','Previous completed runs remain available in Recent research and Saved runs.'));return;
  }
  if(native){
    view.append(el('p','result-answer','Native Hermes has saved its research and source evidence. Review the findings and captured sources before acting.'));
  }else if(result){
    const answer=project.kind==='wallet'?walletAnswer(result):project.kind==='strategy'?strategyAnswer(result):marketAnswer(result);view.append(el('p','result-answer',answer));
  }else view.append(el('p','result-answer','The run finished without a structured result. Inspect the captured evidence and report before using it.'));
  view.append(actions);
  const integrityIssues=detail?.integrity?.issues ?? [];
  if(integrityIssues.length){const notice=el('div','result-notice error');append(notice,el('strong','','Saved evidence needs review.'),list(integrityIssues));view.append(notice);}
  if(!native)renderComparison(view);
  if(native)renderNativeReport(view,detail?.report);
  else if(project.kind==='wallet')renderWallet(view,result);
  else if(project.kind==='strategy')renderStrategy(view,result);
  else renderMarket(view,result);
  renderSources(view,detail);renderFollowup(view);
  append(view,el('p','result-footer','Local research with captured evidence. A source capture or historical simulation does not establish execution readiness or permission to trade.'));
}
function list(items,className){const node=el('ul',className);for(const item of items ?? [])node.append(el('li','',typeof item==='string'?item:JSON.stringify(item)));return node;}
function renderComparison(view){
  const project=selectedProject,run=selectedRun,candidates=(project.runs ?? []).filter(item=>item.id!==run.id&&item.createdAt<run.createdAt&&['complete','partial'].includes(item.state)&&item.execution!=='native-hermes').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const box=el('section','comparison-section');box.setAttribute('aria-label','Compare saved captures');append(box,el('h2','','What changed?'));
  if(!candidates.length){box.append(el('p','comparison-empty','Refresh this research to compare it with an earlier completed capture. Each run keeps its own evidence.'));view.append(box);return;}
  if(!candidates.some(item=>item.id===comparisonBaseline))comparisonBaseline=candidates[0].id;
  const controls=el('div','comparison-controls'),label=el('label'),select=el('select');select.id='comparison-baseline';append(label,el('span','','Compare with'),select);
  for(const item of candidates){const option=el('option','',`${dateTime(item.createdAt)} · ${stateLabel(item.state)} · ${item.id.slice(-8)}`);option.value=item.id;select.append(option);}select.value=comparisonBaseline;
  const open=button('Open earlier capture','text-button',()=>openProject(project.name,select.value));append(controls,label,open);box.append(controls);
  const content=el('div');content.id='comparison-content';content.setAttribute('aria-live','polite');box.append(content);view.append(box);
  const load=()=>{
    const baseline=select.value,key=`${project.name}/${run.id}/${baseline}`;
    if(comparison?.key===key){renderComparisonBody(content,comparison,project.name,run.id,baseline);return;}
    comparison={key,phase:'loading'};renderComparisonBody(content,comparison,project.name,run.id,baseline);
    api(`/api/projects/${encodeURIComponent(project.name)}/runs/${encodeURIComponent(run.id)}/compare?baseline=${encodeURIComponent(baseline)}`).then(value=>{
      if(comparison?.key!==key)return;comparison={key,phase:'ready',value};
      if(currentView==='result'&&selectedProject?.name===project.name&&selectedRun?.id===run.id)renderComparisonBody($('comparison-content'),comparison,project.name,run.id,baseline);
    }).catch(error=>{
      if(comparison?.key!==key)return;comparison={key,phase:'error',error};
      if(currentView==='result'&&selectedProject?.name===project.name&&selectedRun?.id===run.id)renderComparisonBody($('comparison-content'),comparison,project.name,run.id,baseline);
    });
  };
  select.addEventListener('change',()=>{comparisonBaseline=select.value;load();});load();
}
function comparisonValue(row,field){
  const value=row[field];if(value===null||value===undefined)return field==='delta'?'Not compared':'Unavailable';
  // Keep exact signed wallet decimals; a small difference must not round to zero.
  if(row.unit==='USDC')return `${field==='delta'&&Number(value)>0?'+':''}${value} USDC`;
  if(row.unit==='percent')return `${field==='delta'&&Number(value)>0?'+':''}${Number(value).toFixed(2)}${field==='delta'?' pp':'%'}`;
  const formatted=row.unit==='USD'?money(value):count(value);return `${field==='delta'&&Number(value)>0?'+':''}${formatted}`;
}
function renderComparisonBody(content,state,projectName,runId,baseline){
  if(!content)return;content.replaceChildren();content.setAttribute('aria-busy',String(state.phase==='loading'));
  if(state.phase==='loading'){content.append(el('p','comparison-empty','Checking both saved captures and their evidence…'));return;}
  if(state.phase==='error'){
    content.append(errorBox(errorMessage(state.error)));content.append(button('Retry comparison','text-button',()=>{comparison=null;renderResult(true);}));return;
  }
  const value=state.value;content.append(el('p','comparison-summary',value.summary));
  if(value.issues?.length)content.append(list(value.issues,'limit-list comparison-issues'));
  const rowNotes=[];
  for(const group of value.sections ?? []){
    const section=el('div','comparison-group');append(section,el('h3','',group.title),el('p','table-note',group.description));
    const rows=group.rows.map(row=>[row.label,comparisonValue(row,'before'),comparisonValue(row,'after'),comparisonValue(row,'delta')]);section.append(table(['Measure','Earlier capture','This capture','Change'],rows));
    for(const row of group.rows)if(row.note)rowNotes.push(`${row.label}: ${row.note}`);content.append(section);
  }
  const details=el('details','evidence-details comparison-details');details.append(el('summary','','Comparison scope & source changes'));const body=el('div');
  append(body,el('p','table-note',`Earlier ${dateTime(value.baseline.createdAt)} · this capture ${dateTime(value.current.createdAt)}. Values describe saved observations, not current executable prices.`),list(value.notes ?? [],'limit-list'));
  if(rowNotes.length)append(body,el('h3','','Observation details'),list([...new Set(rowNotes)],'limit-list'));
  const changes=value.sourceChanges;for(const [key,title] of [['added','Added source artifacts'],['removed','Missing source artifacts'],['changed','Changed source bytes']])if(changes?.[key]?.length)append(body,el('h3','',title),list(changes[key],'limit-list'));
  if(changes&&!Object.values(changes).some(items=>items.length))body.append(el('p','table-note',value.status==='unavailable'?'Source changes could not be verified for this comparison.':'No source artifact identities or bytes changed.'));
  append(body,el('p','table-note','Source byte changes can include metadata or retrieval times. They do not by themselves establish a market move. Hashes check local consistency, not source accuracy.'));details.append(body);content.append(details);
  content.append(button('Export comparison','text-button',async()=>{
    try{const response=await api(`/api/projects/${encodeURIComponent(projectName)}/runs/${encodeURIComponent(runId)}/compare?baseline=${encodeURIComponent(baseline)}`,{raw:true});downloadBlob(await response.blob(),`boomkin-comparison-${runId}.json`);toast('The comparison and its limitations were exported.');}catch(error){toast(errorMessage(error));}
  }));
}
function renderNativeReport(view,report){
  const box=el('section','result-section native-report');
  if(!report){box.append(el('p','empty-message','No report was saved. Inspect the source evidence and run status.'));view.append(box);return;}
  // Native output is untrusted text. A deliberately small Markdown renderer uses
  // text nodes only, including tables; HTML and embedded images are never run.
  const lines=String(report).split('\n');let paragraph=[],bullets=[],code=[],inCode=false;
  const flush=()=>{if(paragraph.length){box.append(el('p','',paragraph.join(' ')));paragraph=[];}if(bullets.length){box.append(list(bullets,'limit-list'));bullets=[];}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/^```/.test(line)){flush();if(inCode){box.append(el('pre','raw-report',code.join('\n')));code=[];}inCode=!inCode;continue;}
    if(inCode){code.push(line);continue;}
    if(/^\s*\|/.test(line)&&/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i+1] ?? '')){
      flush();const cells=value=>value.trim().replace(/^\||\|$/g,'').split('|').map(value=>value.trim());const headers=cells(line),rows=[];i+=2;while(i<lines.length&&/^\s*\|/.test(lines[i])){rows.push(cells(lines[i]));i++;}i--;box.append(table(headers,rows));continue;
    }
    const title=line.match(/^#{1,6}\s+(.+)$/);
    if(title){flush();box.append(el('h2','',title[1]));continue;}
    const bullet=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if(bullet){if(paragraph.length)flush();bullets.push(bullet[1]);continue;}
    if(!line.trim()){flush();continue;}
    if(bullets.length)flush();paragraph.push(line.trim());
  }
  flush();if(code.length)box.append(el('pre','raw-report',code.join('\n')));view.append(box);
}
function walletAnswer(result){
  if(!result?.outcome)return 'Wallet accounting is unavailable. Review the captured evidence and gaps.';
  const net=result.outcome.observedNetUsdc;
  return net===null?'The captured activity has no comparable net USDC subtotal. Missing reads or fees in another currency remain explicit below.':`The captured default-perp activity has an observed net outcome of ${money(net,'USDC')} USDC across ${count(result.outcome.fillCount)} fills: closed PnL minus signed fees plus signed funding. This is a bounded activity subtotal, not your portfolio return.`;
}
function marketAnswer(result){
  const valid=(result?.reads ?? []).flatMap(read=>(read.observations ?? []).filter(row=>row.ok));
  if(!valid.length)return 'No fresh valid USD mark was available. The failed or stale observations remain in the source record.';
  const comparison=result.comparisons?.[0];return comparison?.status==='aligned'?`At capture, ${valid.length} fresh USD observations aligned within the declared timestamp limit. The provider spread was ${percent(comparison.spreadPct,false)}. These are aggregate marks; they are not executable quotes.`:`At capture, ${valid.length} valid USD observation${valid.length===1?' was':'s were'} available. The sources do not support an aligned price comparison. Missing, stale or differently timed observations stay explicit.`;
}
function strategyAnswer(result){
  const test=result?.periods?.heldOut?.baseline;if(!test)return 'The frozen-rule result is unavailable. Inspect the input and validation evidence.';
  return `In the held-out period, the rule returned ${percent(test.metrics.timeWeightedReturnPct)} after modeled costs, compared with ${percent(test.benchmark.metrics.timeWeightedReturnPct)} for same-flow buy-and-hold. The reference and held-out periods restart independently; this is historical research.`;
}
function renderMetrics(view,kind,result){const row=el('div','metrics');for(const item of metricsFor(kind,result)){const box=el('div','metric'),strong=el('strong',item.negative?'negative':'',item.value);if(item.unit&&item.value!=='Unavailable')strong.append(el('span','unit',item.unit));append(box,el('span','',item.label),strong,el('small','',item.note));row.append(box);}view.append(row);}
function table(headers,rows){const wrap=el('div','table-scroll'),node=el('table','data-table'),head=el('thead'),headRow=el('tr'),body=el('tbody');for(const header of headers){const th=el('th','',header);th.scope='col';headRow.append(th);}head.append(headRow);for(const row of rows){const tr=el('tr');for(const value of row)tr.append(el('td','',value));body.append(tr);}if(!rows.length){const tr=el('tr'),td=el('td','','No observed records in this capture.');td.colSpan=headers.length;tr.append(td);body.append(tr);}append(node,head,body);wrap.append(node);return wrap;}
function section(title,description){const node=el('section','result-section');node.append(el('h2','',title));if(description)node.append(el('p','',description));return node;}
function remainingRows(label,headers,rows){const details=el('details','evidence-details');details.append(el('summary','',label));const contents=el('div');contents.append(table(headers,rows));details.append(contents);return details;}
function renderWallet(view,result){
  if(!result)return;
  const notice=el('div','result-notice');append(notice,el('strong','',result.coverage?.status==='partial'?'Partial history.':'Bounded history.'),document.createTextNode(' Complete window coverage is unverified. Only default-perp activity is accounted; spot and HIP-3 history are excluded. Current exposure reflects sequential capture time.'));
  if(result.coverage?.gaps?.length)notice.append(list(result.coverage.gaps));view.append(notice);renderMetrics(view,'wallet',result);
  const costs=section('Where the costs came from'),costRows=(result.execution?.costConcentration ?? []).filter(row=>Number(row.positiveFeesUsdc)>0).map(row=>[row.coin,money(row.positiveFeesUsdc,'USDC'),percent(row.positiveFeeSharePercent,false),percent(row.notionalSharePercent,false)]),costHeaders=['Market','Positive fees (USDC)','Fee share','Notional share'];
  if(costRows.length){costs.append(table(costHeaders,costRows.slice(0,5)));if(costRows.length>5)costs.append(remainingRows(`All ${costRows.length} markets with positive fees`,costHeaders,costRows));}
  else costs.append(el('p','empty-message','No positive USDC fee charges were observed in the captured activity.'));
  costs.append(el('p','table-note',`Positive fee charges ${money(result.execution?.positiveFeesUsdc,'USDC')} USDC · rebates ${money(result.execution?.rebatesUsdc,'USDC')} USDC. Builder fees are already included. Values are rounded for display; exact decimals are retained in the report.`));view.append(costs);
  const exposure=section('Current default-perp positions');
  if(result.exposure?.positions===null)exposure.append(el('p','empty-message','Current positions are unavailable. Inspect the failed capture and gaps.'));
  else {const positions=(result.exposure?.positions ?? []).slice().sort((a,b)=>Number(b.notionalUsdc)-Number(a.notionalUsdc)),headers=['Market','Side','Size','Notional (USDC)','Unrealized PnL (USDC)'],rows=positions.map(row=>[row.coin,row.side,row.signedSize,money(row.notionalUsdc,'USDC'),money(row.unrealizedPnlUsdc,'USDC')]);exposure.append(table(headers,rows.slice(0,5)));if(rows.length>5)append(exposure,el('p','table-note',`Five largest positions by observed notional, from ${rows.length} captured positions.`),remainingRows(`All ${rows.length} current positions`,headers,rows));}
  exposure.append(el('p','table-note','Unrealized PnL is separate from the observed activity subtotal. Observed open orders do not establish stop protection.'));view.append(exposure);
}
function renderMarket(view,result){
  if(!result)return;
  if(result.status!=='complete'){const note=el('div','result-notice');append(note,el('strong','','Some source observations are unavailable.'),document.createTextNode(' Missing or stale prices are excluded; no consensus mark is invented.'));view.append(note);}
  renderMetrics(view,'market',result);
  const source=section('The source comparison','Prices are compared only when fresh observations are close enough in time.');
  const rows=[];for(const read of result.reads ?? [])for(const observation of read.observations ?? [])rows.push([sourceName(read.source),observation.ok?money(observation.priceUsd):'Unavailable',observation.ok?dateTime(observation.observedAt):'Unavailable',observation.ok?`${count(observation.ageSeconds)} sec`:String(observation.error ?? 'Source read failed')]);source.append(table(['Source','USD mark','Price observed at','Age at capture / error'],rows));
  source.append(el('p','table-note','The CoinGecko-ID observation from DefiLlama may share upstream data. Agreement does not establish independent oracle corroboration.'));view.append(source);
}
function renderStrategy(view,result){
  if(!result)return;
  const historical=!result.provenance?.synthetic,notice=el('div','result-notice');append(notice,el('strong','',historical?'Historical simulation.':'Synthetic price series.'),document.createTextNode(historical?' The supplied rule is frozen across two separate periods. Daily aggregate marks and fixed costs do not model executable venue fills.':' This series is an invented price path. It provides no evidence of real asset performance.'));view.append(notice);renderMetrics(view,'strategy',result);
  const held=result.periods?.heldOut?.baseline,reference=result.periods?.reference?.baseline;
  if(held){view.append(drawChart(held));}
  const scenarios=section('One rule, four checks');
  const rows=[];for(const [name,period] of Object.entries(result.periods ?? {}))for(const scenario of ['baseline','higherCosts']){const test=period[scenario];if(test)rows.push([`${name==='heldOut'?'Held-out':'Reference'} · ${scenario==='baseline'?'baseline':'higher costs'}`,percent(test.metrics.timeWeightedReturnPct),percent(test.benchmark.metrics.timeWeightedReturnPct),percent(test.metrics.maxDrawdownPct,false),count(test.metrics.tradeCount),money(test.metrics.totalFeesUsd+test.metrics.totalSlippageUsd)]);}
  scenarios.append(table(['Period / costs','Rule return','Buy-and-hold','Drawdown','Trades','Modeled costs'],rows));
  scenarios.append(el('p','table-note',`Reference ${dateOnly(reference?.period?.firstObservation)} to ${dateOnly(reference?.period?.lastObservation)}; held-out ${dateOnly(held?.period?.firstObservation)} to ${dateOnly(held?.period?.lastObservation)}. Each starts with ${money(result.accounting?.initialCashUsdPerPeriod)} and fresh indicator warmup. No parameters are selected or optimized.`));view.append(scenarios);
  if(held){const trades=el('details','evidence-details');trades.append(el('summary','',`Inspect held-out simulated trades (${held.trades?.length ?? 0})`));const contents=el('div');contents.append(table(['Decision (UTC)','Execution (UTC)','Side','Fill (USD)','Fee (USD)','Slippage (USD)'],(held.trades ?? []).map(row=>[dateOnly(row.decisionAt),dateOnly(row.executedAt),row.side,money(row.fillUsd),money(row.feeUsd),money(row.slippageUsd)])));trades.append(contents);view.append(trades);}
}
function svgNode(tag,attributes,text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [name,value] of Object.entries(attributes))node.setAttribute(name,String(value));if(text!==undefined)node.textContent=String(text);return node;}
function drawChart(result){
  const chart=el('div','chart'),title=el('div','chart-title');append(title,el('span','','Held-out flow-neutral return index'),el('span','',`${result.period?.observations ?? 0} daily observations`));chart.append(title);
  const svg=svgNode('svg',{viewBox:'0 0 720 255',role:'img','aria-label':'Held-out strategy return index compared with same-flow buy-and-hold; both begin at 100'}),series=[result.equityCurve ?? [],result.benchmark?.equityCurve ?? []],values=series.flatMap(rows=>rows.map(row=>Number(row.returnIndex)*100)).filter(Number.isFinite);
  if(!values.length)return chart;
  const low=Math.min(...values),high=Math.max(...values),range=Math.max(high-low,1),bottom=low-range*.12,top=high+range*.12,left=52,width=645,height=190,yTop=13,y=value=>yTop+(top-value)/(top-bottom)*height;
  for(let i=0;i<4;i++){const value=bottom+(top-bottom)*i/3,py=y(value);append(svg,svgNode('path',{d:`M${left} ${py}h${width}`,stroke:'#324e5c','stroke-width':1,fill:'none'}),svgNode('text',{x:left-10,y:py+4,'text-anchor':'end',fill:'#7096aa','font-size':9,'font-family':'Manrope'},value.toFixed(0)));}
  for(const [index,rows] of series.entries()){const path=rows.map((row,i)=>`${i?'L':'M'}${left+i/Math.max(rows.length-1,1)*width} ${y(Number(row.returnIndex)*100)}`).join(' ');svg.append(svgNode('path',{d:path,stroke:index?'#779cb1':'#e7f06a','stroke-width':index?1.8:2,fill:'none'}));}
  append(svg,svgNode('text',{x:left,y:235,fill:'#7199ad','font-size':9,'font-family':'Manrope'},dateOnly(result.period?.firstObservation)),svgNode('text',{x:left+width,y:235,'text-anchor':'end',fill:'#7199ad','font-size':9,'font-family':'Manrope'},dateOnly(result.period?.lastObservation)));chart.append(svg);
  const key=el('div','chart-key');append(key,append(el('span'),el('i'),document.createTextNode('Frozen rule')),append(el('span'),el('i','benchmark'),document.createTextNode('Buy-and-hold')),el('span','','Historical replay'));chart.append(key);return chart;
}
function renderSources(view,captured){
  const items=observations(captured?.evidence),result=captured?.result;
  if(!items.length&&!result&&!captured?.report)return;
  const sourceDetails=el('details','sources-details'),sourceSummary=el('summary');append(sourceSummary,el('span','','Sources & coverage'),el('span','',`${items.length} captured artifact${items.length===1?'':'s'}`));sourceDetails.append(sourceSummary);
  const sources=el('div','source-contents');sources.append(el('p','source-summary',`${items.length} captured source artifact${items.length===1?'':'s'}. Retrieval timestamps describe the capture; a historical price observation can be older.`));
  const rows=el('div','source-list');for(const item of items){const row=el('div','source-row'),copy=el('div'),sequence=Number(String(item.artifact).match(/read-(\d+)\./)?.[1]),entry=result?.evidence?.entries?.find(entry=>entry.sequence===sequence),entryLabel=entry?({userRole:'Public account identity',userAbstraction:'Account balance mode',clearinghouseState:'Current perpetual exposure',spotClearinghouseState:'Spot token balances',frontendOpenOrders:'Visible open orders',userFillsByTime:'Observed fill history',userFunding:'Funding cashflows'}[entry.type] ?? entry.type):undefined;
    append(copy,el('strong','',entryLabel || item.summary || sourceName(item.source)),el('p','',`${sourceName(item.source)} · retrieved ${dateTime(item.observedAt)} · ${age(item.observedAt)}`));const safe=safeExternalUrl(item.source);if(safe)copy.append(link(safe,safe,'source-url'));row.append(copy);row.append(button('Raw response ↗','text-button',()=>downloadArtifact(item)));rows.append(row);}sources.append(rows);
  if(result?.provenance)append(sources,el('p','table-note',`${result.provenance.synthetic?'Synthetic dataset':'Dataset provenance'} · source ${result.provenance.source} · retrieved ${dateTime(result.provenance.retrievedAt)} · ${age(result.provenance.retrievedAt)}. ${selectedProject.inputs?.datasetSource==='upload'?'Provenance supplied by the uploaded file.':''}`));
  sourceDetails.append(sources);view.append(sourceDetails);
  const expanded=el('details','evidence-details');expanded.append(el('summary','','Inspect evidence, hashes & assumptions'));const contents=el('div'),issues=captured?.integrity?.issues ?? [];
  const checked=['complete','partial'].includes(selectedRun?.state);
  contents.append(el('p','integrity-label',issues.length?'Evidence integrity needs review.':items.length&&checked?'Saved artifact hashes match the local manifest. Hashes establish captured-byte consistency; they do not independently authenticate the source.':items.length?'Captured artifact hashes are recorded below. This incomplete run has not passed the completed-result integrity check.':'Review the report and saved inputs.'));
  for(const item of items){const row=el('div','hash-row');append(row,el('strong','',`${item.id} · SHA-256`),el('code','',item.sha256));contents.append(row);}
  if(result?.inputHashes){const row=el('div','hash-row');append(row,el('strong','','Input hashes'),el('pre','',JSON.stringify(result.inputHashes,null,2)));contents.append(row);}
  const limits=[...new Set([...(result?.limitations ?? []),...(result?.assumptions ?? []),...(result?.coverage?.historyRetention?[result.coverage.historyRetention]:[]),...items.flatMap(item=>item.limitations ?? [])])];if(limits.length){append(contents,el('h3','','Limits and assumptions'),list(limits,'limit-list'));}
  if(captured?.report){append(contents,el('h3','','Saved report'),el('pre','raw-report',captured.report));}
  const raw=el('details','evidence-details');raw.append(el('summary','','Structured result'));const rawBox=el('div');rawBox.append(el('pre','raw-report',JSON.stringify(result ?? {},null,2)));raw.append(rawBox);contents.append(raw);expanded.append(contents);view.append(expanded);
}
function renderProgress(view,run,project){
  const progress=el('div','progress-box');progress.setAttribute('role','status');const title=el('div','progress-heading'),spinner=el('span','progress-spinner');spinner.setAttribute('aria-hidden','true');append(title,spinner,el('span','',progressText(run,project.kind)));progress.append(title);
  const descriptions={wallet:'Fetching bounded public account history, preserving raw responses, then calculating fees, funding and current exposure.',market:'Reading public sources and checking price age and timestamp alignment. Missing or stale values stay visible.',strategy:'Validating the daily inputs, independently restarting both periods, and comparing the rule with buy-and-hold at two cost levels.'};
  append(progress,el('p','progress-copy',run.execution==='native-hermes'?'Native Hermes is answering your question using the saved evidence and its available tools. Your chosen model may incur charges; sources and missing information belong in the saved report.':descriptions[project.kind]),el('div','progress-track'));progress.querySelector('.progress-track').setAttribute('aria-hidden','true');
  const cancel=button('Cancel this capture','text-button cancel-button',async()=>{cancel.disabled=true;try{const value=await api(runPath('/cancel'),{method:'POST'});selectedRun=value.run;detail={...detail,run:value.run};renderResult(true);await loadProjects();announce('Research cancelled. Saved source responses are preserved.');schedulePoll();}catch(error){cancel.disabled=false;progress.append(errorBox(errorMessage(error)));}});progress.append(cancel);progress.append(el('p','progress-copy','You can leave this page and return through Recent research. Keep the desk server running while the job finishes.'));view.append(progress);
}
async function refreshRun(refresh=true){
  if(requestBusy)return;requestBusy=true;const requestedNavigation=navigation,projectName=selectedProject.name;
  try{const value=await api(`/api/projects/${encodeURIComponent(projectName)}/${refresh?'refresh':'run'}`,{method:'POST'});await loadProjects();if(requestedNavigation===navigation)await openProject(projectName,value.run.id);announce('A fresh research run has started.');}
  catch(error){toast(errorMessage(error));}
  finally{requestBusy=false;if(currentView==='result')renderResult(true);}
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),anchor=el('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportResult(){try{const response=await api(runPath('/export'),{raw:true});downloadBlob(await response.blob(),`boomkin-${selectedProject.kind}-${selectedRun.id}.json`);toast('The saved report and evidence bundle were exported.');}catch(error){toast(errorMessage(error));}}
async function downloadArtifact(item){try{const response=await api(runPath(`/evidence/${encodeURIComponent(item.id)}`),{raw:true});downloadBlob(await response.blob(),`boomkin-${String(item.id).replace(/[^a-zA-Z0-9_-]/g,'-')}.json`);}catch(error){toast(errorMessage(error));}}
function renderFollowup(view){
  const box=el('section','followup-section');append(box,el('h2','','Take the next question deeper.'),el('p','',profileReady()?'Ask your native Hermes agent to explain this saved evidence. The captured data is the starting point; a live agent can gather additional sources.':'Connect a model through native Hermes to ask follow-up questions about this saved evidence.'));
  if(!profileReady()){box.append(button('Connect your model','text-button',showSettings));view.append(box);return;}
  const form=el('form','followup-form'),fieldBox=el('label','field'),label=el('span','sr-only','Question for the native Hermes agent'),textarea=el('textarea');textarea.name='question';textarea.rows=2;textarea.maxLength=2000;textarea.required=true;textarea.placeholder=selectedProject.kind==='wallet'?'Which captured markets contributed most to my fees?':selectedProject.kind==='strategy'?'What assumptions matter most for this result?':'What else should I check about this asset?';append(fieldBox,label,textarea);const submit=el('button','button subtle','Ask native Hermes');submit.type='submit';append(form,fieldBox,submit);box.append(form);box.append(el('p','followup-notice','This starts a native agent request. Your chosen model and connected tools may incur charges.'));
  const projectName=selectedProject.name,runId=selectedRun.id;
  box.append(el('p','followup-notice',`Based on the selected capture from ${dateTime(selectedRun.createdAt)}.`));
  form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;const prior=submit.textContent,requestedNavigation=navigation;submit.textContent='Preparing…';try{const value=await api(`/api/projects/${encodeURIComponent(projectName)}/followup`,{method:'POST',body:{question:textarea.value.trim(),maxTurns:10,runId}});await loadProjects();if(requestedNavigation===navigation)await openProject(value.project.name,value.run.id);announce('Native Hermes has started the follow-up research.');}catch(error){box.append(errorBox(errorMessage(error)));}finally{submit.disabled=false;submit.textContent=prior;}});view.append(box);
}

function schedulePoll(delay=1600){clearTimeout(pollTimer);pollTimer=setTimeout(poll,delay);}
async function poll(){
  if(!token)return;
  try{
    const old=JSON.stringify({setup:status?.setup,profile:status?.profile});await loadStatus();
    if(JSON.stringify({setup:status.setup,profile:status.profile})!==old){if(currentView==='setup')renderSetup();else if(currentView==='settings')renderSettings();else if(currentView==='result')renderResult(true);}
    const activeProjects=projects.some(project=>project.runs?.some(run=>!TERMINAL_STATES.includes(run.state)));
    if(activeProjects||selectedRun&&!TERMINAL_STATES.includes(selectedRun.state)){await loadProjects();
      if(currentView==='result'&&selectedProject&&selectedRun){const name=selectedProject.name,id=selectedRun.id,captured=await api(`/api/projects/${encodeURIComponent(name)}/runs/${encodeURIComponent(id)}`);if(currentView==='result'&&selectedProject?.name===name&&selectedRun?.id===id){const previous=selectedRun.state;selectedRun=captured.run;detail=captured;selectedProject=projects.find(project=>project.name===name) ?? selectedProject;renderResult();if(previous!==selectedRun.state&&TERMINAL_STATES.includes(selectedRun.state))announce(`Research ${stateLabel(selectedRun.state).toLowerCase()}.`);}}
    }
    $('poll-error')?.remove();
  }catch(error){setConnection(false);if(currentView==='result'&&!$('poll-error')){const message=el('p','poll-error',errorMessage(error)+' The displayed capture remains saved.');message.id='poll-error';message.setAttribute('role','status');$('result-view').append(message);}}
  schedulePoll(status?.setup?.state==='running'?1000:2500);
}
async function boot(){
  showView('connection',{focus:false});$('connection-heading').textContent='Opening your desk.';$('connection-message').textContent='Checking the local server and available research tools…';$('reconnect').hidden=true;
  try{await loadStatus();await loadProjects();if(storage.get('boomkin.desk.welcome')==='seen'&&status?.capabilities?.some(item=>item.ready))showDesk();else renderSetup({focus:true});schedulePoll();}
  catch(error){setConnection(false);$('connection-heading').textContent='Your desk needs its local server.';$('connection-message').textContent=errorMessage(error);$('reconnect').hidden=false;}
}
$('home-link').addEventListener('click',event=>{event.preventDefault();if(status)showDesk();});
$('new-research').addEventListener('click',()=>{if(status)newResearch();});
$('settings-button').addEventListener('click',()=>{if(status)showSettings();});
$('reconnect').addEventListener('click',boot);
$('question-form').addEventListener('submit',event=>{event.preventDefault();pendingQuestion=$('question').value.trim();const inferred=inferTask(pendingQuestion);showTask(inferred.kind,inferred);});
$('question').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('question-form').requestSubmit();}});
for(const choice of document.querySelectorAll('[data-task]'))choice.addEventListener('click',()=>{pendingQuestion='';showTask(choice.dataset.task);});
$('mobile-menu').addEventListener('click',()=>{const open=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',open);$('mobile-menu').setAttribute('aria-expanded',String(open));$('sidebar-overlay').hidden=!open;if(open)$('new-research').focus();});
$('sidebar-overlay').addEventListener('click',()=>{closeSidebar();$('mobile-menu').focus();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('sidebar').classList.contains('open')){closeSidebar();$('mobile-menu').focus();}});
document.addEventListener('keydown',event=>{if(event.key!=='Tab'||!$('sidebar').classList.contains('open'))return;const focusable=Array.from($('sidebar').querySelectorAll('a[href],button:not([disabled])')),first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedulePoll(1);});
window.addEventListener('pagehide',()=>clearTimeout(pollTimer));
await boot();
