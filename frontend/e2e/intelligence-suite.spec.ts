import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  const password = process.env.NEXUS_ADMIN_PASSWORD;
  if (!password) throw new Error('Set NEXUS_ADMIN_PASSWORD for browser integration tests');
  const response = await request.post('/api/auth/login', { data: { username: 'admin', password } });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript((value) => sessionStorage.setItem('nexus.session', JSON.stringify(value)), session);
});

test('Investigation Intelligence Suite: full walkthrough across all 6 capabilities', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Investigation workspace', exact: true })).toBeVisible();

  // Ensure demo dataset is loaded and analyzed
  await page.getByRole('button', { name: 'Load demo', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze Network', exact: true }).click();

  // Navigate to Investigation Intelligence
  await page.getByRole('button', { name: 'Investigation Intelligence' }).click();
  await expect(page.getByRole('heading', { name: 'Investigation Intelligence Workbench' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('intelligence-workbench-overview.png'), fullPage: true });

  // ----------------------------------------------------
  // 1. Investigation Replay
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Investigation Replay' }).click();
  await expect(page.getByText('Evidence Playback & Graph Evolution')).toBeVisible();
  await expect(page.getByText('Step Sequence Feed')).toBeVisible();

  // Test slider / scrubber interaction
  const slider = page.locator('input[type="range"]');
  await expect(slider).toBeVisible();
  await slider.fill('5');
  await slider.dispatchEvent('change');
  await expect(page.getByText('Cumulative Network Scope At Step 5')).toBeVisible();

  // Test Play/Pause toggle
  const playBtn = page.getByRole('button', { name: 'Play', exact: true });
  await playBtn.click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();

  await page.screenshot({ path: testInfo.outputPath('investigation-replay.png'), fullPage: true });

  // ----------------------------------------------------
  // 2. Counterfactual / What-If Analysis
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Counterfactual / What-If' }).click();
  await expect(page.getByText('Safe In-Memory Simulation Sandbox')).toBeVisible();
  await expect(page.getByText('CANONICAL_GRAPH_UNCHANGED=true')).toBeVisible();

  // Select Preset Scenario: Exclude Decoy Identifier SYN-PHONE-061
  await page.getByText('Exclude Decoy Identifier SYN-PHONE-061').click();
  const runSimBtn = page.getByRole('button', { name: 'Run What-If Simulation' });
  await runSimBtn.click();

  // Verify simulation results
  await expect(page.getByText('Counterfactual Analytical Impact')).toBeVisible();
  await expect(page.getByText('Entities Removed', { exact: true })).toBeVisible();
  await expect(page.getByText('Database Unaltered')).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('what-if-simulation.png'), fullPage: true });

  // ----------------------------------------------------
  // 3. Contradiction Engine (Rules C1–C6)
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Contradiction Engine' }).click();
  await expect(page.getByRole('heading', { name: 'Contradiction & Cross-Case Discrepancy Engine' })).toBeVisible();

  // Verify detected rule cards (C1, C4, C5)
  await expect(page.getByText('C1: Multi-Person Identifier').first()).toBeVisible();
  await expect(page.getByText('C4: Near-Duplicate Identity').first()).toBeVisible();

  // Filter by Rule C1
  await page.getByRole('button', { name: 'C1', exact: true }).click();
  await expect(page.getByText('Multi-Person Identifier Conflict: SYN-PHONE-001')).toBeVisible();

  // Open review modal and submit an ACKNOWLEDGED determination
  const reviewBtn = page.locator('button', { hasText: 'Review Discrepancy' }).first();
  if (await reviewBtn.isVisible()) {
    await reviewBtn.click();
    await expect(page.getByText('Investigator Review Action')).toBeVisible();
    await page.locator('textarea').fill('Verified shared burner phone used across multiple fraudulent identities');
    await page.getByRole('button', { name: 'Save Determination' }).click();
    await expect(page.getByText('Review decision recorded successfully.')).toBeVisible();
  }

  await page.screenshot({ path: testInfo.outputPath('contradiction-engine.png'), fullPage: true });

  // ----------------------------------------------------
  // 4. Evidence Trail Mode
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Evidence Trail Mode' }).click();
  await expect(page.getByRole('heading', { name: 'Evidence Trail: Why Are These Entities Connected?' })).toBeVisible();

  // Apply hypothesis preset Aariv Veylan -> Mira Solven
  await page.locator('button', { hasText: 'Aariv Veylan' }).filter({ hasText: 'Mira Solven' }).first().click();
  await expect(page.getByText('Evidentiary Chain Synthesis')).toBeVisible();
  await expect(page.getByText('Forensic Grounding:').first()).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('evidence-trail.png'), fullPage: true });

  // ----------------------------------------------------
  // 5. Investigation Gaps
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Investigation Gaps' }).click();
  await expect(page.getByRole('heading', { name: 'Investigation Gap Finder & Actionable Next Steps' })).toBeVisible();
  await expect(page.getByText('Suggested Procedural Next Steps:').first()).toBeVisible();

  // Filter by Unresolved Identifier
  const unresolvedBtn = page.locator('button', { hasText: 'Unresolved Identifier' }).first();
  if (await unresolvedBtn.isVisible()) {
    await unresolvedBtn.click();
  }

  await page.screenshot({ path: testInfo.outputPath('investigation-gaps.png'), fullPage: true });

  // ----------------------------------------------------
  // 6. Network Change Radar
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Network Change Radar' }).click();
  await expect(page.getByRole('heading', { name: 'Network Change Radar: Impact of Ingested Records' })).toBeVisible();
  await expect(page.getByText('Milestone #1')).toBeVisible();
  await expect(page.getByText('Cross-Case Bridge Formed').first()).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('network-change-radar.png'), fullPage: true });

  // ----------------------------------------------------
  // 7. Inspector Context Action Navigation
  // ----------------------------------------------------
  await page.getByRole('button', { name: 'Investigation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search entities' }).fill('Aariv Veylan');
  await page.locator('.search-results').getByRole('button').first().click();

  // Verify Inspector has Evidence Trail button
  const inspectorTrailBtn = page.locator('.inspector button', { hasText: 'Evidence Trail' });
  await expect(inspectorTrailBtn).toBeVisible();
  await inspectorTrailBtn.click();

  // Should navigate directly to Investigation Intelligence
  await expect(page.getByRole('heading', { name: 'Investigation Intelligence Workbench' })).toBeVisible();

  expect(errors).toEqual([]);
});
