import {test,expect, type Page} from '@playwright/test';
const graph={nodes:[],edges:[],evidence:[],records:[],analysis:{},analyzed:false,suggestions:[]};
async function fixture(page:Page){
 await page.addInitScript(()=>sessionStorage.setItem('nexus.session',JSON.stringify({token:'old-token',username:'viewer',role:'VIEWER',expiresAt:new Date(Date.now()+600000).toISOString()})));
 await page.route('**/api/graph',r=>r.fulfill({json:graph}));
 await page.route('**/api/workflow',r=>r.fulfill({json:{notes:[],watchlist:[],triage:[]}}));
 await page.route('**/api/quality',r=>r.fulfill({status:503,json:{error:{message:'Fixture unavailable'}}}));
}
async function replaceSession(page:Page,username='viewer'){
 await page.evaluate(username=>{sessionStorage.setItem('nexus.session',JSON.stringify({token:'new-token',username,role:'VIEWER',expiresAt:new Date(Date.now()+600000).toISOString()}));window.dispatchEvent(new CustomEvent('nexus-session',{detail:{expired:false}}));},username);
}
test('old download 401 cannot clear a newer session',async({page})=>{
 await fixture(page);await page.route('**/api/auth/me',r=>r.fulfill({json:{username:'viewer',role:'VIEWER'}}));
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});let started!:()=>void;const requested=new Promise<void>(resolve=>{started=resolve});
 await page.route('**/api/exports/nodes.csv',async r=>{started();await pending;await r.fulfill({status:401,json:{error:{message:'Expired old request'}}});});
 await page.goto('/');await page.getByRole('button',{name:'Reports',exact:true}).click();await page.getByRole('button',{name:'Download nodes CSV'}).click();await requested;
 await replaceSession(page);release();
 await expect(page.getByText('Error: Expired old request',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('nexus.session')!).token)).toBe('new-token');
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
});
test('old identity refresh cannot overwrite a newer session',async({page})=>{
 await fixture(page);let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});let started!:()=>void;const requested=new Promise<void>(resolve=>{started=resolve});
 await page.route('**/api/auth/me',async r=>{started();await pending;await r.fulfill({json:{username:'viewer',role:'VIEWER'}})});
 await page.goto('/');await requested;await replaceSession(page,'investigator');release();
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('nexus.session')!).username)).toBe('investigator');
});
