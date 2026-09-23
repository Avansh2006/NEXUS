import { test, expect } from '@playwright/test';
const n=(id:string,type:string,cases:string[])=>({id,type,label:id,properties:{caseIds:cases,evidenceIds:[]}});
const edge=(id:string,source:string,target:string,day:string,caseId:string)=>({id,source,target,type:'LINK',properties:{caseIds:[caseId],evidenceIds:[],firstSeen:day,lastSeen:day,events:[{timestamp:day,evidenceId:id,amount:0}]}});
const graph={nodes:[n('alpha','Person',['A']),n('phone','Phone',['A']),n('beta','Person',['B']),n('account','Account',['B']),{...n('caseA','Case',['A']),label:'A'},{...n('caseB','Case',['B']),label:'B'}],edges:[edge('early','alpha','phone','2026-09-01T00:00:00Z','A'),edge('late','beta','account','2026-09-02T00:00:00Z','B')],records:[],evidence:[],suggestions:[],analyzed:true,analysis:{communities:[{id:0,entityIds:['alpha','phone']},{id:1,entityIds:['beta','account']}],metrics:[]}};
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('nexus.session',JSON.stringify({token:'mock',username:'admin',role:'ADMIN',expiresAt:new Date(Date.now()+600000).toISOString()})));
 await page.route('**/api/**',r=>r.fulfill({json:r.request().url().endsWith('/auth/me')?{username:'admin',role:'ADMIN'}:r.request().url().endsWith('/graph')?graph:r.request().url().endsWith('/workflow')?{notes:[],watchlist:[],triage:[]}:[]}));
 await page.goto('/');await expect(page.getByLabel('Playback instant',{exact:true})).toBeEnabled();
});
test('changing case filter realigns playback cutoff and graph',async({page})=>{
 await page.getByLabel('Playback instant',{exact:true}).fill('0');
 await page.getByLabel('Case filter').selectOption('B');
 await expect(page.locator('.cytoscape')).toHaveAttribute('data-entity-types','Account,Person');
 await expect(page.locator('.playback output')).toHaveText('2026-09-02T00:00:00.000Z');
});
test('meta communities obey filters and note drafts survive watchlist changes',async({page})=>{
 await page.getByRole('button',{name:'Toggle Community Meta-Node View'}).click();
 await page.getByLabel('Entity type filter').selectOption('Vehicle');
 await expect(page.locator('.cytoscape')).toHaveAttribute('data-entity-types','');
 await page.getByLabel('Entity type filter').selectOption('All types');
 await page.getByLabel('Search entities').fill('alpha');await page.locator('.search-results button').first().click();
 await page.getByLabel('New entity note').fill('Unsaved review draft');
 await page.getByRole('button',{name:'Add to watchlist',exact:true}).click();
 await expect(page.getByLabel('New entity note')).toHaveValue('Unsaved review draft');
});
test('incoming graph changes refresh workflow and reset playback',async({page})=>{
 await page.getByLabel('Playback instant',{exact:true}).fill('0');
 await page.route('**/api/workflow',r=>r.fulfill({json:{notes:[],watchlist:['phone'],triage:[]}}));
 await page.route('**/api/demo/incoming',r=>r.fulfill({json:{graph,caseId:'NXS-007',latencyMs:0,newNodes:[],crossCaseLinks:[]}}));
 await page.getByRole('button',{name:'Stream FIR NXS-007'}).click();
 await expect(page.getByLabel('Playback instant',{exact:true})).toHaveValue('1');
 const watchlist=page.locator('.workflow-panel').filter({has:page.getByRole('heading',{name:'My watchlist'})});
 await expect(watchlist.getByRole('button',{name:'phone',exact:true})).toBeVisible();
 await page.route('**/api/workflow',r=>r.fulfill({json:{notes:[],watchlist:[],triage:[]}}));
 await page.route('**/api/demo/incoming/remove',r=>r.fulfill({json:{graph}}));
 await page.getByRole('button',{name:'Retract NXS-007'}).click();
 await expect(watchlist).toContainText('No watched entities.');
});
