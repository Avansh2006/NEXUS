import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  const password = process.env.NEXUS_ADMIN_PASSWORD;
  if (!password) throw new Error('Set NEXUS_ADMIN_PASSWORD for browser integration tests');
  const response = await request.post('/api/auth/login', { data: { username: 'admin', password } });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript(value => sessionStorage.setItem('nexus.session', JSON.stringify(value)), session);
});

test('visual identity search: sample fixture → candidate detection → confirmation modal → history', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Investigation workspace', exact: true })).toBeVisible();

  // Reset and Load Demo data to ensure consistent graph state
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('button', { name: 'Load demo', exact: true }).click();
  await expect(page.locator('.stat').filter({ hasText: 'Source records' }).locator('.animated-count')).toHaveAttribute('aria-label', '121');

  // Navigate to Visual Identity tab
  const visionNavBtn = page.getByRole('button', { name: 'Visual Identity' });
  await expect(visionNavBtn).toBeVisible();
  await visionNavBtn.click();

  // Verify Visual Identity Search view is mounted
  await expect(page.getByRole('heading', { name: 'Visual Identity Search' })).toBeVisible();
  await expect(page.getByText('ADAFACE IR-101 + SCRFD')).toBeVisible();

  // Take screenshot of empty search state
  await page.screenshot({ path: testInfo.outputPath('visual-identity-initial.png'), fullPage: true });

  // Enroll demo faces if gallery is empty
  const seedBtn = page.getByRole('button', { name: 'Seed Demo Face Gallery' });
  if (await seedBtn.isVisible()) {
    await seedBtn.click();
    await expect(page.getByText(/Demo face gallery populated/i)).toBeVisible({ timeout: 15000 });
  }

  // Click on the 1-click bundled test fixture: Aariv Veylan (Surveillance CCTV)
  const aarivFixture = page.getByRole('button', { name: /Aariv Veylan \(Surveillance CCTV\)/i });
  await expect(aarivFixture).toBeVisible({ timeout: 10000 });
  await aarivFixture.click();

  // Click Run Visual Identity Search button
  const searchBtn = page.getByRole('button', { name: 'Run Visual Identity Search' });
  await expect(searchBtn).toBeEnabled({ timeout: 10000 });
  await searchBtn.click();

  // Verify search completed and candidate is visible
  await expect(page.getByText('Aariv Veylen').first()).toBeVisible({ timeout: 25000 });

  // Verify candidate is labelled as a candidate (not definitive identification)
  await expect(page.getByText(/CANDIDATE/i).first()).toBeVisible();

  // Screenshot candidate search result
  await page.screenshot({ path: testInfo.outputPath('visual-identity-results.png'), fullPage: true });

  // Open Confirm Match modal
  const confirmBtn = page.getByRole('button', { name: 'Confirm Match' }).first();
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  // Modal should be visible
  await expect(page.getByRole('heading', { name: 'Confirm Face Match' })).toBeVisible();
  const notesField = page.getByPlaceholder(/Visual match corroborated/i);
  await notesField.fill('Browser E2E: Confirmed visual alignment on surveillance crop.');

  // Submit confirmation
  const submitDecisionBtn = page.getByRole('button', { name: 'Submit CONFIRMED' });
  await submitDecisionBtn.click();

  // Switch to Decisions tab to verify recorded decision
  const decisionsTabBtn = page.getByRole('button', { name: /Decisions/i }).first();
  await expect(decisionsTabBtn).toBeVisible();
  await decisionsTabBtn.click();
  await expect(page.getByText('CONFIRMED').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('visual-identity-decisions.png'), fullPage: true });

  // Return to Investigation and verify graph was NOT automatically merged
  await page.getByRole('button', { name: 'Investigation' }).click();
  await expect(page.getByRole('heading', { name: 'Investigation workspace', exact: true })).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: 'Entities' }).locator('.animated-count')).toHaveAttribute('aria-label', '146');

  expect(errors).toEqual([]);
});
