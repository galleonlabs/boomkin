// Small, dependency-free presentation helpers shared by the desk and its tests.
export const KIND_LABELS = Object.freeze({market:'Asset research',wallet:'Wallet review',strategy:'Strategy test'});
export const TERMINAL_STATES = Object.freeze(['complete','partial','failed','cancelled','interrupted']);
export const ASSETS = Object.freeze([
  {id:'ethereum',name:'Ethereum',symbol:'ETH'},
  {id:'bitcoin',name:'Bitcoin',symbol:'BTC'},
  {id:'solana',name:'Solana',symbol:'SOL'},
]);
export const TEMPLATES = Object.freeze([
  {id:'sma-10',label:'10-day moving average',description:'Hold the asset when its price is above its 10-day average. Signals execute at the next daily mark.'},
  {id:'sma-30',label:'30-day moving average',description:'Hold the asset when its price is above its 30-day average. Signals execute at the next daily mark.'},
  {id:'buy-and-hold',label:'Buy and hold',description:'Buy once at the second daily observation and hold through each period.'},
  {id:'weekly-dca',label:'Funded weekly DCA',description:'Buy from the declared starting cash every seven observations, up to the budget per buy. No automatic new deposits.'},
]);
export function assetName(id) { return ASSETS.find(asset=>asset.id===id)?.name ?? String(id ?? 'Unknown asset'); }
export function shortAddress(address) { return /^0x[0-9a-f]{40}$/i.test(String(address)) ? `${address.slice(0,6)}…${address.slice(-4)}` : String(address ?? 'Unknown account'); }
export function money(value, currency='USD') {
  if(value===null || value===undefined || value==='' || !Number.isFinite(Number(value))) return 'Unavailable';
  const number=Number(value);
  if(currency==='USD') return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:Math.abs(number)>0&&Math.abs(number)<.01?6:2}).format(number);
  return new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(number);
}
export function percent(value, signed=true) {
  if(value===null || value===undefined || !Number.isFinite(Number(value))) return 'Unavailable';
  const number=Number(value);
  return `${signed&&number>=0?'+':''}${number.toFixed(2)}%`;
}
export function count(value) { return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US').format(Number(value)) : 'Unavailable'; }
export function dateTime(value) {
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(date)+' UTC' : 'Time unavailable';
}
export function dateOnly(value) {
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date) : 'Time unavailable';
}
export function age(value, now=Date.now()) {
  const timestamp=Date.parse(value),seconds=Math.floor((now-timestamp)/1000);
  if(!Number.isFinite(timestamp)) return 'Age unavailable';
  if(seconds<-60) return 'Future timestamp';
  if(seconds<60) return 'Just now';
  if(seconds<3600) return `${Math.floor(seconds/60)} min ago`;
  if(seconds<86400) return `${Math.floor(seconds/3600)} hr ago`;
  return `${Math.floor(seconds/86400)} days ago`;
}
export function sourceName(value) {
  if(['coingecko','defillama','hyperliquid'].includes(value))return {coingecko:'CoinGecko',defillama:'DefiLlama',hyperliquid:'Hyperliquid'}[value];
  try {const host=new URL(value).hostname;return {'api.hyperliquid.xyz':'Hyperliquid','api.hyperliquid-testnet.xyz':'Hyperliquid testnet','api.coingecko.com':'CoinGecko','coins.llama.fi':'DefiLlama'}[host] ?? host.replace(/^www\./,'');}
  catch {return String(value ?? 'Local artifact');}
}
export function safeExternalUrl(value) {
  try { const url=new URL(value); return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password ? url.href : null; }
  catch {return null;}
}
export function safeLoopbackUrl(value) {
  try {const url=new URL(value);return url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password?url.href:null;}
  catch {return null;}
}
export function observations(evidence) { return Array.isArray(evidence?.observations)?evidence.observations:Array.isArray(evidence)?evidence:[]; }
export function stateLabel(state) {
  return {queued:'Preparing',running:'Working',complete:'Captured',partial:'Partial evidence',failed:'Could not finish',cancelled:'Cancelled',interrupted:'Interrupted'}[state] ?? 'Saved';
}
export function progressText(run,kind) {
  const progress=run?.progress;
  const last=Array.isArray(progress)?progress.at(-1):progress;
  const message=typeof last==='string'?last:last?.message ?? last?.label ?? last?.stage;
  return message || {wallet:'Fetching account history',market:'Capturing public price marks',strategy:'Validating the frozen rule'}[kind] || 'Preparing the research';
}
export function inferTask(question) {
  const text=String(question).trim(),address=text.match(/\b0x[0-9a-fA-F]{40}\b/)?.[0];
  if(address) return {kind:'wallet',account:address};
  if(/\b(strategy|backtest|moving.?average|dca|buy.and.hold|sma)\b/i.test(text)) return {kind:'strategy'};
  for(const asset of ASSETS) if(new RegExp(`\\b(${asset.id}|${asset.symbol})\\b`,'i').test(text)) return {kind:'market',asset:asset.id};
  const exact=text.match(/^(?:research|check|price(?:\s+of)?)\s+([a-z0-9][a-z0-9-]{0,99})[?.!]?$/i)?.[1]?.toLowerCase();
  return {kind:'market',...(exact?{asset:exact}:{})};
}
export function metricsFor(kind,result) {
  if(kind==='wallet') return [
    {label:'Observed net outcome',value:money(result?.outcome?.observedNetUsdc,'USDC'),unit:'USDC',note:'Captured default-perp activity',negative:Number(result?.outcome?.observedNetUsdc)<0},
    {label:'Signed fees',value:money(result?.outcome?.signedFeesByToken?.USDC ?? (result?.outcome?'0':null),'USDC'),unit:'USDC',note:'Negative fees are rebates'},
    {label:'Signed funding',value:money(result?.outcome?.fundingUsdc,'USDC'),unit:'USDC',note:'Negative is cash paid'},
    {label:'Current gross exposure',value:money(result?.exposure?.grossNotionalUsdc,'USDC'),unit:'USDC',note:'At sequential capture time'},
  ];
  if(kind==='strategy') {
    const test=result?.periods?.heldOut?.baseline;
    return [
      {label:'Held-out rule return',value:percent(test?.metrics?.timeWeightedReturnPct),note:'After modeled trading costs',negative:Number(test?.metrics?.timeWeightedReturnPct)<0},
      {label:'Buy-and-hold return',value:percent(test?.benchmark?.metrics?.timeWeightedReturnPct),note:'Same period, cash flows and costs'},
      {label:'Rule drawdown',value:percent(test?.metrics?.maxDrawdownPct,false),note:'Held-out flow-neutral index'},
      {label:'Simulated trades',value:count(test?.metrics?.tradeCount),note:'Held-out rule only'},
    ];
  }
  const reads=result?.reads ?? [],valid=reads.flatMap(read=>(read.observations ?? []).filter(row=>row.ok));
  return [
    ...valid.slice(0,2).map(row=>({label:`${sourceName(reads.find(read=>read.provider===row.provider)?.source ?? row.provider)} USD mark`,value:money(row.priceUsd),note:`Observed ${age(row.observedAt)}`})),
    ...(valid.length?[]:[{label:'USD price mark',value:'Unavailable',note:'No fresh valid observation'}]),
    {label:'Provider spread',value:percent(result?.comparisons?.[0]?.spreadPct,false),note:result?.comparisons?.[0]?.status==='aligned'?'Aligned fresh observations':'No aligned comparison'},
    {label:'Valid observations',value:`${valid.length} / ${reads.reduce((total,read)=>total+(read.observations?.length ?? 0),0)}`,note:'Missing or stale values stay explicit'},
  ];
}
export const ERROR_COPY = Object.freeze({
  unauthorized:'This desk session has expired. Reopen the URL printed by “boomkin desk” in your terminal.',
  invalid_token:'This desk session has expired. Reopen the URL printed by “boomkin desk” in your terminal.',
  stale_price:'The source price is older than the freshness limit. Refresh later to capture a new observation.',
  missing_tools:'The research tools are not installed in this profile. Open Settings and prepare the public tools.',
  invalid_dataset:'The uploaded dataset does not match the daily USD format. Check the dataset guide and try again.',
  too_many_requests:'The public source is rate limited. Your previous research is safe. Wait before refreshing.',
  network_error:'The local server could not be reached. Keep “boomkin desk” running in your terminal, then try again.',
});
export function errorMessage(error) {
  if(error?.error&&typeof error.error==='object')return errorMessage(error.error);
  const code=typeof error==='string'?error:error?.code ?? error?.error;
  return ERROR_COPY[code] ?? (typeof error?.message==='string'?error.message:typeof error?.error==='string'?error.error:typeof error==='string'?error:'The request could not finish. Your saved research is preserved.');
}
