import { test, expect } from '@playwright/test';

const graph = {
  nodes: [
    {id:'alpha',type:'Person',label:'Alpha Example',properties:{caseIds:['CASE-1'],evidenceIds:[]}},
    {id:'phone',type:'Phone',label:'SYN-PHONE-001',properties:{caseIds:['CASE-1'],evidenceIds:[]}},
  ],
  edges: [{id:'link',source:'alpha',target:'phone',type:'USES_PHONE',properties:{caseIds:['CASE-1'],evidenceIds:[],firstSeen:'2026-09-01T00:00:00Z',lastSeen:'2026-09-01T00:00:00Z',events:[{timestamp:'2026-09-01T00:00:00Z',evidenceId:'link'}]}}],
  records:[],evidence:[],suggestions:[],analyzed:true,analysis:{metrics:[],communities:[]},
};

test('workflow text is readable and mobile navigation stays inside the viewport', async ({page}) => {
  await page.addInitScript(() => sessionStorage.setItem('nexus.session',JSON.stringify({token:'mock',username:'admin',role:'ADMIN',expiresAt:new Date(Date.now()+600000).toISOString()})));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const response = path.endsWith('/auth/me') ? {username:'admin',role:'ADMIN'}
      : path.endsWith('/graph') ? graph
      : path.endsWith('/workflow') ? {notes:[],watchlist:[],triage:[]}
      : path.endsWith('/quality') ? {precision:1,recall:1,samples:1,scope:'Mock data'}
      : [];
    return route.fulfill({json:response});
  });
  await page.goto('/');
  await page.getByLabel('Search entities').fill('Alpha');
  await page.locator('.search-results button').first().click();
  await expect(page.getByRole('heading',{name:'Investigator workspace'})).toBeVisible();
  const contrast = await page.locator('.workflow-panel').first().evaluate(panel => {
    const parse = (value:string) => value.match(/[\d.]+/g)!.slice(0,3).map(Number);
    const luminance = (rgb:number[]) => rgb.map(c => { const x=c/255; return x<=.04045 ? x/12.92 : ((x+.055)/1.055)**2.4; }).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
    const bg = luminance(parse(getComputedStyle(panel).backgroundColor));
    const heading = luminance(parse(getComputedStyle(panel.querySelector('h3')!).color));
    const text = luminance(parse(getComputedStyle(panel.querySelector('p')!).color));
    return {heading:(Math.max(bg,heading)+.05)/(Math.min(bg,heading)+.05),text:(Math.max(bg,text)+.05)/(Math.min(bg,text)+.05)};
  });
  expect(contrast.heading).toBeGreaterThan(4.5);
  expect(contrast.text).toBeGreaterThan(4.5);
  await page.screenshot({path:'../artifacts/ui-refinement-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Reports',exact:true}).click();
  await expect(page.getByRole('button',{name:'Diagnostics',exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  const trigger = await page.getByRole('button',{name:'Open NEXUS Intel Copilot'}).boundingBox();
  const exportButton = await page.getByRole('button',{name:'Download nodes CSV'}).boundingBox();
  expect(trigger).not.toBeNull();
  expect(exportButton).not.toBeNull();
  const overlaps = trigger!.x < exportButton!.x + exportButton!.width && trigger!.x + trigger!.width > exportButton!.x && trigger!.y < exportButton!.y + exportButton!.height && trigger!.y + trigger!.height > exportButton!.y;
  expect(overlaps).toBe(false);
  await page.screenshot({path:'../artifacts/ui-refinement-mobile.png',fullPage:true});
});
