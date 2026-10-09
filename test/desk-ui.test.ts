import {expect,test} from 'bun:test';
import {inferTask,money,percent,count,age,safeExternalUrl,safeLoopbackUrl,metricsFor,errorMessage,progressText} from '../desk/ui.js';

test('desk maps explicit common assets and wallet addresses without ticker substring matches',()=>{
  expect(inferTask('What should I understand about ETH?')).toEqual({kind:'market',asset:'ethereum'});
  expect(inferTask('Research BTC')).toEqual({kind:'market',asset:'bitcoin'});
  expect(inferTask('Test a 30-day moving average')).toEqual({kind:'strategy'});
  expect(inferTask('Review 0x010461c14e146ac35fe42271bdc1134ee31c703a')).toEqual({kind:'wallet',account:'0x010461c14e146ac35fe42271bdc1134ee31c703a'});
  expect(inferTask('What about something obscure?').asset).toBeUndefined();
  expect(inferTask('Could solvency improve?').asset).toBeUndefined();
});

test('missing numeric observations never become zero-valued claims',()=>{
  for(const value of [undefined,null,'',NaN,Infinity,'missing']){
    expect(money(value)).toBe('Unavailable');
    expect(count(value)).toBe('Unavailable');
  }
  expect(percent(null)).toBe('Unavailable');
  expect(money('0','USDC')).toBe('0.00');
  expect(money('-0.001')).toBe('-$0.001');
  expect(percent(0)).toBe('+0.00%');
  const wallet=metricsFor('wallet',{outcome:{observedNetUsdc:null,signedFeesByToken:{USDC:'-1.25'},fundingUsdc:'0'},exposure:{grossNotionalUsdc:null}});
  expect(wallet[0].value).toBe('Unavailable');
  expect(wallet[1].value).toBe('-1.25');
  expect(wallet[2].value).toBe('0.00');
  expect(wallet[3].value).toBe('Unavailable');
});

test('links from captured or native output cannot execute code or redirect native setup off loopback',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','https://user:password@example.com/'])expect(safeExternalUrl(value)).toBeNull();
  expect(safeExternalUrl('https://api.hyperliquid.xyz/info')).toBe('https://api.hyperliquid.xyz/info');
  for(const value of ['https://127.0.0.1/env','http://127.0.0.1.attacker.test/env','http://evil.test/env','http://user:password@127.0.0.1/env'])expect(safeLoopbackUrl(value)).toBeNull();
  expect(safeLoopbackUrl('http://127.0.0.1:12345/env')).toBe('http://127.0.0.1:12345/env');
});

test('source age and meaningful progress keep unavailable or future times explicit',()=>{
  const now=Date.parse('2026-10-09T12:00:00.000Z');
  expect(age('bad timestamp',now)).toBe('Age unavailable');
  expect(age('2026-10-09T12:03:00.000Z',now)).toBe('Future timestamp');
  expect(age('2026-10-02T12:00:00.000Z',now)).toBe('7 days ago');
  expect(progressText({progress:'Reading user funding'},'wallet')).toBe('Reading user funding');
  expect(progressText({},'strategy')).toBe('Validating the frozen rule');
});

test('API error envelopes preserve actionable server messages and session recovery instructions',()=>{
  expect(errorMessage({error:{message:'The bundled historical dataset is Bitcoin'}})).toBe('The bundled historical dataset is Bitcoin');
  expect(errorMessage({code:'unauthorized'})).toContain('Reopen the URL');
  expect(errorMessage({code:'network_error'})).toContain('Keep “boomkin desk” running');
});
