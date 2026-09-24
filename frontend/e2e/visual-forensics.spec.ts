import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  const password = process.env.NEXUS_ADMIN_PASSWORD;
  if (!password) throw new Error('Set NEXUS_ADMIN_PASSWORD for browser integration tests');
  const response = await request.post('/api/auth/login', { data: { username: 'admin', password } });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript((value) => sessionStorage.setItem('nexus.session', JSON.stringify(value)), session);
});

test('Visual Forensics & Judicial Dossier: full verification across all 4 capabilities', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Investigation workspace', exact: true })).toBeVisible();

  // Load synthetic investigation
  await page.getByRole('button', { name: /(Reload|Load) demo/i }).first().click();
  await page.getByRole('button', { name: 'Analyze Network', exact: true }).click();

  // ----------------------------------------------------
  // 1. Live Cytoscape Investigation Replay
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Investigation Intelligence' }).click();
  await page.getByRole('button', { name: 'Investigation Replay' }).click();
  await expect(page.getByText('Evidence Playback & Graph Evolution')).toBeVisible();

  // Launch Replay on Graph Canvas
  const launchReplayBtn = page.getByRole('button', { name: 'View on Graph' });
  await expect(launchReplayBtn).toBeVisible();
  await launchReplayBtn.click();

  // Verify Graph Canvas HUD appears
  await expect(page.locator('.replay-hud')).toBeVisible();
  await expect(page.getByText('INVESTIGATION REPLAY')).toBeVisible();
  await expect(page.getByText('STEP 1 /')).toBeVisible();

  // Step navigation on canvas
  const nextStepBtn = page.locator('.replay-hud button[title="Next Step"]');
  await expect(nextStepBtn).toBeVisible();
  await nextStepBtn.click();
  await expect(page.getByText('STEP 2 /')).toBeVisible();

  // Speed controls
  await page.locator('.replay-hud button', { hasText: '2x' }).click();

  await page.screenshot({ path: testInfo.outputPath('visual-replay-hud.png') });

  // Exit Replay
  await page.getByRole('button', { name: 'Exit Replay' }).click();
  await expect(page.locator('.replay-hud')).not.toBeVisible();

  // ----------------------------------------------------
  // 2. Counterfactual Graph Ghosting
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Investigation Intelligence' }).click();
  await page.getByRole('button', { name: 'Counterfactual / What-If' }).click();
  await expect(page.getByText('Safe In-Memory Simulation Sandbox')).toBeVisible();

  // Select Preset Scenario: Exclude Decoy Identifier SYN-PHONE-061
  await page.getByText('Exclude Decoy Identifier SYN-PHONE-061').click();
  await page.getByRole('button', { name: 'Run What-If Simulation' }).click();
  await expect(page.getByText('Counterfactual Analytical Impact')).toBeVisible();

  // Launch What-If on Graph Canvas (Ghosting Mode)
  const launchWhatIfBtn = page.getByRole('button', { name: 'View on Graph Canvas' });
  await expect(launchWhatIfBtn).toBeVisible();
  await launchWhatIfBtn.click();

  // Verify Simulation Banner on Cytoscape Graph Canvas
  await expect(page.locator('.simulation-banner')).toBeVisible();
  await expect(page.getByText('SIMULATION MODE — Canonical investigation unchanged')).toBeVisible();

  // Switch simulation display modes
  await page.getByRole('button', { name: 'Simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Canonical', exact: true }).click();
  await page.getByRole('button', { name: 'Overlay', exact: true }).click();

  await page.screenshot({ path: testInfo.outputPath('visual-counterfactual-ghosting.png') });

  // Exit Simulation
  await page.getByRole('button', { name: 'Exit Simulation' }).click();
  await expect(page.locator('.simulation-banner')).not.toBeVisible();

  // ----------------------------------------------------
  // 3. Evidence Path Highlighting ("Why Are These Connected?")
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Investigation Intelligence' }).click();
  await page.getByRole('button', { name: 'Evidence Trail Mode' }).click();
  await expect(page.getByRole('heading', { name: 'Evidence Trail: Why Are These Entities Connected?' })).toBeVisible();

  // Select preset Aariv Veylan -> Mira Solven
  await page.locator('button', { hasText: 'Aariv Veylan' }).filter({ hasText: 'Mira Solven' }).first().click();
  await expect(page.getByText('Evidentiary Chain Synthesis')).toBeVisible();

  // Launch Evidence Path on Canvas
  const launchTrailBtn = page.getByRole('button', { name: 'View on Graph Canvas' });
  await expect(launchTrailBtn).toBeVisible();
  await launchTrailBtn.click();

  // Verify Evidence Trail Banner on Canvas
  await expect(page.locator('.evidence-trail-banner')).toBeVisible();
  await expect(page.getByText('EVIDENCE TRAIL:')).toBeVisible();
  await expect(page.getByText('Aariv Veylan ↔ Mira Solven')).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('visual-evidence-path-highlighting.png') });

  // Clear Evidence Trail Highlight
  await page.getByRole('button', { name: 'Clear Evidence Highlight' }).click();
  await expect(page.locator('.evidence-trail-banner')).not.toBeVisible();

  // ----------------------------------------------------
  // 4. Audit Chain Verification & Dossier Export
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Investigation Dossier Export' })).toBeVisible();

  // Verify Chain of Custody in Audit Panel
  const verifyChainBtn = page.getByRole('button', { name: 'Verify Chain of Custody' });
  await expect(verifyChainBtn).toBeVisible();
  await verifyChainBtn.click();

  // Check valid status badge and cryptographic details
  await expect(page.getByText('AUDIT CHAIN VALID')).toBeVisible();
  await expect(page.getByText('Genesis Hash')).toBeVisible();
  await expect(page.getByText('Head Hash')).toBeVisible();

  // Check Dossier section checkboxes
  await expect(page.getByText('1. Case Overview & Scope')).toBeVisible();
  await expect(page.getByText('12. Cryptographic Audit Certificate')).toBeVisible();
  await expect(page.getByText('13. BSA 2023 Section 63 Template')).toBeVisible();
  await expect(page.getByText('14. Safeguards & Limitations Statement')).toBeVisible();

  // Preview Dossier Modal
  const previewDossierBtn = page.getByRole('button', { name: 'Preview Dossier' });
  await expect(previewDossierBtn).toBeVisible();
  await previewDossierBtn.click();

  await expect(page.getByText('INVESTIGATION DOSSIER — LIVE PREVIEW')).toBeVisible();
  const iframe = page.locator('#dossier-preview-frame');
  await expect(iframe).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('visual-dossier-preview-modal.png') });

  // Close modal
  await page.getByLabel('Close preview').click();
  await expect(page.getByText('INVESTIGATION DOSSIER — LIVE PREVIEW')).not.toBeVisible();

  expect(errors).toEqual([]);
});
