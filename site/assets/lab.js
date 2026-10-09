import {runBacktest,runStrategyValidation,STRATEGY_TEMPLATES,createStrategySpec} from '../vendor/strategy-engine.mjs';
import {toast} from './app.js';
const $=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
const pct=value=>`${value>=0?'+':''}${value.toFixed(2)}%`;
let fixture,historical,uploaded,engineProvenance,report,validation,currentDataset,currentSpec;
const errors={nonconsecutive_daily_candles:'Prices must be consecutive daily observations. Remove duplicates and fill missing dates from the verified source.',invalid_timestamp:'Every observation needs a canonical midnight UTC timestamp, such as 2026-01-01T00:00:00.000Z.',invalid_strategy:'Check the strategy settings. The average period must be shorter than the price series.',invalid_provenance:'Add valid source, retrieval time and synthetic status to the dataset provenance.',invalid_price:'Prices must be finite positive USD values.',observation_after_retrieval:'A price observation is later than its recorded retrieval time.',invalid_candle_count:'Provide between 2 and 10,000 daily price observations.',unsupported_dataset:'Use the documented daily USD dataset format.',invalid_dataset:'The dataset does not match the documented format.',invalid_identity:'Use an explicit asset namespace and ID.',invalid_spec:'Check starting cash, fees and slippage.'};
function updateSettings(){
  const type=$('strategy').value;
  $('period-field').hidden=type!=='sma';$('period').disabled=type!=='sma';
  $('dca-amount-field').hidden=type!=='dca';$('dca-frequency-field').hidden=type!=='dca';
  $('dca-amount').disabled=type!=='dca';$('dca-frequency').disabled=type!=='dca';
  $('upload-field').hidden=$('dataset').value!=='upload';
}
function resetValidation(){validation=undefined;$('validation-results').hidden=true;$('validation-rows').replaceChildren();$('download-validation').disabled=true;}
for(const template of STRATEGY_TEMPLATES){const option=document.createElement('option');option.value=template.id;option.textContent=template.label;$('strategy-template').append(option);}
$('strategy-template').addEventListener('change',()=>{
  invalidateResults('');
  const template=STRATEGY_TEMPLATES.find(item=>item.id===$('strategy-template').value);
  if(template){
    try{
    const spec=createStrategySpec(template.id,{initialCashUsd:Number($('initial-cash').value),feeBps:Number($('fee').value),slippageBps:Number($('slippage').value),...(template.strategy.type==='dca'?{amountUsd:Number($('dca-amount').value)}:{})});
    $('strategy').value=spec.strategy.type;if(spec.strategy.period)$('period').value=spec.strategy.period;
    if(spec.strategy.everyBars)$('dca-frequency').value=spec.strategy.everyBars;
    $('template-note').textContent=`${template.horizon.minimumValidationObservations} observations minimum for both periods; ${template.horizon.recommendedValidationObservations} recommended. ${template.requiredData.join(' ')}`;
    }catch{$('strategy-template').value='custom';invalidateResults('Set valid starting cash, fees, slippage and a DCA budget before choosing a template.');return;}
  }else $('template-note').textContent='Choose a documented starting point or enter your own frozen rule.';
  updateSettings();resetValidation();
});
$('strategy').addEventListener('change',updateSettings);$('dataset').addEventListener('change',updateSettings);
$('lab-form').addEventListener('input',()=>invalidateResults(''));
$('lab-form').addEventListener('change',event=>{if(event.target.id!=='strategy-template')invalidateResults('');});
for(const id of ['strategy','period','dca-frequency'])$(id).addEventListener('change',()=>{$('strategy-template').value='custom';$('template-note').textContent='Custom settings. Freeze the rule before examining its held-out result.';});
function invalidateResults(message){
  resetValidation();
  report=undefined;$('download-report').disabled=true;$('download-inputs').disabled=true;
  $('lab-error').textContent=message;$('lab-error').hidden=!message;
  ['metric-return','metric-drawdown','metric-equity','metric-benchmark'].forEach(id=>$(id).textContent='—');
  $('trades-heading').textContent='Simulated trades';
  $('chart-title').textContent='No completed test';$('chart-period').textContent='';$('chart-note').textContent='';
  $('equity-chart').replaceChildren();$('trade-rows').replaceChildren();$('lab-evidence').textContent='No result for the current inputs. Correct them and rerun the test.';
}
$('dataset-file').addEventListener('change',async()=>{
  uploaded=undefined;
  const file=$('dataset-file').files[0];if(!file)return;
  if(file.size>2_000_000){invalidateResults('The dataset is larger than 2 MB. Use a smaller daily series.');return;}
  try{const value=JSON.parse(await file.text());uploaded=value?.ok===true&&value.dataset?value.dataset:value;toast('Dataset loaded. Run the test to validate it.');}
  catch{invalidateResults('The file is not valid JSON. Export a dataset in the documented format.');}
});
function plot(result){
  const series=[result.equityCurve,result.benchmark.equityCurve];
  const values=series.flatMap(rows=>rows.map(row=>row.returnIndex*100));
  const low=Math.min(...values),high=Math.max(...values),range=Math.max(high-low,1),pad=range*.12;
  const bottom=low-pad,top=high+pad,w=620,h=212,left=60,yTop=15;
  const y=value=>yTop+(top-value)/(top-bottom)*h;
  let html='';
  for(let i=0;i<4;i++){const value=bottom+(top-bottom)*i/3,py=y(value);html+=`<path class="grid-line" d="M${left} ${py}h${w}"/><text x="${left-10}" y="${py+4}" text-anchor="end" fill="#91a7b2" font-size="10" font-family="Manrope">${value.toFixed(0)}</text>`;}
  series.forEach((rows,index)=>{const path=rows.map((row,i)=>`${i?'L':'M'}${left+i/(rows.length-1)*w} ${y(row.returnIndex*100)}`).join(' ');html+=`<path class="${index?'benchmark-line':'strategy-line'}" d="${path}"/>`;});
  html+=`<text x="${left}" y="257" fill="#91a7b2" font-size="10" font-family="Manrope">${result.period.firstObservation.slice(0,10)}</text><text x="${left+w}" y="257" text-anchor="end" fill="#91a7b2" font-size="10" font-family="Manrope">${result.period.lastObservation.slice(0,10)}</text>`;
  $('equity-chart').innerHTML=html;
}
function render(result){
  $('lab-error').hidden=true;
  $('metric-return').textContent=pct(result.metrics.timeWeightedReturnPct);$('metric-drawdown').textContent=`${result.metrics.maxDrawdownPct.toFixed(2)}%`;
  $('metric-equity').textContent=money(result.metrics.endingEquityUsd);$('metric-benchmark').textContent=pct(result.benchmark.metrics.timeWeightedReturnPct);
  $('chart-title').textContent=`${result.identity.id} · ${result.priceType==='venue-close'?'Daily close':'Daily price marks'}`;
  $('chart-period').textContent=`${result.period.observations} observations`;
  $('chart-note').textContent=result.provenance.synthetic?'Synthetic prices':'Historical observations';
  plot(result);
  $('lab-evidence').textContent=`${result.provenance.synthetic?'Synthetic series':'Historical observations'} · Source: ${result.provenance.source} · Retrieved: ${result.provenance.retrievedAt} · ${result.metrics.tradeCount} trades · Fees ${money(result.metrics.totalFeesUsd)} · Slippage ${money(result.metrics.totalSlippageUsd)}. Flow-neutral index starts at 100. ${result.priceType==='aggregate-snapshot'?'Aggregated price marks are not venue candle closes.':''}`;
  $('trades-heading').textContent=`Simulated trades (${result.trades.length})`;
  const fragment=document.createDocumentFragment();
  for(const trade of result.trades){const tr=document.createElement('tr');for(const value of [trade.decisionAt.slice(0,10),trade.executedAt.slice(0,10),trade.side,money(trade.fillUsd),money(trade.feeUsd),money(trade.slippageUsd)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}fragment.append(tr);}
  if(!result.trades.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='The rule did not produce a filled trade during this period.';tr.append(td);fragment.append(tr);}
  $('trade-rows').replaceChildren(fragment);$('download-report').disabled=false;$('download-inputs').disabled=false;
}
function run(){
  resetValidation();
  const dataset=$('dataset').value==='upload'?uploaded:$('dataset').value==='bitcoin'?historical:fixture;
  if(!dataset){invalidateResults('Choose a valid dataset JSON file before running the test.');return false;}
  const type=$('strategy').value;
  const strategy=type==='sma'?{type,period:Number($('period').value)}:type==='dca'?{type,amountUsd:Number($('dca-amount').value),everyBars:Number($('dca-frequency').value)}:{type};
  const spec={schemaVersion:1,initialCashUsd:Number($('initial-cash').value),feeBps:Number($('fee').value),slippageBps:Number($('slippage').value),strategy};
  try{report=runBacktest(dataset,spec);currentDataset=dataset;currentSpec=spec;render(report);return true;}
  catch(error){invalidateResults(errors[error.code]??`The test could not run (${error.code??'invalid_input'}). Check the dataset and strategy settings.`);return false;}
}
$('lab-form').addEventListener('submit',event=>{event.preventDefault();run();});
function renderValidation(result){
  const fragment=document.createDocumentFragment();
  for(const [periodName,period] of Object.entries(result.periods))for(const scenario of ['baseline','higherCosts']){
    const test=period[scenario],tr=document.createElement('tr');
    const label=`${periodName==='heldOut'?'Held-out':'Reference'} / ${scenario==='baseline'?'baseline':'higher costs'}`;
    for(const value of [label,pct(test.metrics.timeWeightedReturnPct),pct(test.benchmark.metrics.timeWeightedReturnPct),`${test.metrics.maxDrawdownPct.toFixed(2)}%`,test.metrics.tradeCount,money(test.metrics.totalFeesUsd+test.metrics.totalSlippageUsd)]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}fragment.append(tr);
  }
  $('validation-rows').replaceChildren(fragment);
  const reference=result.periods.reference.baseline,heldOut=result.periods.heldOut.baseline;
  $('validation-summary').textContent=`Reference ${reference.period.firstObservation.slice(0,10)} to ${reference.period.lastObservation.slice(0,10)}; held-out ${heldOut.period.firstObservation.slice(0,10)} to ${heldOut.period.lastObservation.slice(0,10)}. Each restarts with ${money(currentSpec.initialCashUsd)} and a fresh warmup. Higher costs use ${result.periods.reference.higherCosts.spec.feeBps} bps fees and ${result.periods.reference.higherCosts.spec.slippageBps} bps slippage. No parameters were selected or optimized. A period you have already used to tune this rule is no longer held out.`;
  $('validation-results').hidden=false;$('download-validation').disabled=false;
}
$('validate-rule').addEventListener('click',()=>{
  if(!run())return;
  try{const split=$('split-index').value;validation=runStrategyValidation(currentDataset,currentSpec,split?{splitIndex:Number(split)}:{});renderValidation(validation);}
  catch(error){resetValidation();$('lab-error').hidden=false;$('lab-error').textContent=`Validation could not run (${error.code??'invalid_input'}). Use enough observations for the rule in both periods, a whole-number split index, and baseline costs below the 1000 bps ceiling. The full-period backtest remains available.`;}
});
function download(filename,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-report').addEventListener('click',()=>{if(report)download('boomkin-backtest-report.json',report);});
$('download-validation').addEventListener('click',async()=>{
  const captured=validation,dataset=currentDataset,spec=currentSpec;
  if(!captured)return;
  const exact=value=>JSON.stringify(value,null,2)+'\n';
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(exact(value))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  try{const [dataSha256,specSha256]=await Promise.all([hash(dataset),hash(spec)]);download('boomkin-strategy-validation.json',{...captured,engine:engineProvenance,inputHashes:{encoding:'UTF-8 JSON.stringify(value, null, 2) plus newline; identical to downloaded inputs',dataSha256,specSha256}});}
  catch{toast('Could not hash the inputs. Use the standalone skill for a verifiable report.');}
});
$('download-inputs').addEventListener('click',()=>{if(report){download('boomkin-dataset.json',currentDataset);setTimeout(()=>download('boomkin-strategy.json',currentSpec),200);}});
try{const responses=await Promise.all(['../data/synthetic-daily.json','../data/bitcoin-180d.json','../vendor/provenance.json'].map(path=>fetch(new URL(path,import.meta.url))));if(responses.some(response=>!response.ok))throw new Error();[fixture,historical,engineProvenance]=await Promise.all(responses.map(response=>response.json()));updateSettings();$('run').disabled=false;$('validate-rule').disabled=false;$('run').textContent='Run strategy test';run();}
catch{invalidateResults('The bundled prices could not load. Reload this page, or upload a daily dataset.');$('run').disabled=false;$('validate-rule').disabled=false;$('run').textContent='Run strategy test';updateSettings();}
