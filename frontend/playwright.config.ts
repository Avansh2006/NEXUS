import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',
  fullyParallel:false,
  workers:1,
  timeout:120000,
  expect:{timeout:15000},
  retries:0,
  outputDir:'../artifacts/playwright',
  reporter:[['list'],['html',{outputFolder:'../artifacts/playwright-report',open:'never'}]],
  use:{
    actionTimeout:15000,
    baseURL:process.env.NEXUS_UI_URL??'http://localhost:8080',
    viewport:{width:1440,height:1000},
    channel:process.env.PLAYWRIGHT_CHANNEL||undefined,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'on',
  },
});
