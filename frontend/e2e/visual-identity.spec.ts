import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function getCredentials() {
  let credentials: any = {};
  try {
    const credPath = path.resolve(process.cwd(), '../.tools/credentials.json');
    if (fs.existsSync(credPath)) {
      credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    }
  } catch {
    // fallback
  }
  return {
    adminPassword: process.env.NEXUS_ADMIN_PASSWORD || credentials.admin?.password || 'ZAnYeTpSbu9ainRYo1EELguTrN3twZlh',
    investigatorPassword: process.env.NEXUS_INVESTIGATOR_PASSWORD || credentials.investigator?.password || 'TFw3vJQtf9b37aPWSq0OhBHBha2oOqLo',
    viewerPassword: process.env.NEXUS_VIEWER_PASSWORD || credentials.viewer?.password || '-GxYeD8f13u58HMGtgZ8J4Fa88utj5Os',
  };
}

test.describe('Visual Identity Search', () => {
  test('empty database → EMPTY_GALLERY state → viewer RBAC check → responsive seeding → Aariv CCTV candidate match', async ({ page, request }, testInfo) => {
    const { adminPassword, viewerPassword, investigatorPassword } = getCredentials();

    // 1. Reset database to ensure empty workspace and empty face gallery
    const adminLogin = await request.post('/api/auth/login', { data: { username: 'admin', password: adminPassword } });
    expect(adminLogin.ok()).toBeTruthy();
    const adminSession = await adminLogin.json();

    const resetResp = await request.post('/api/demo/reset', {
      headers: { Authorization: `Bearer ${adminSession.token}` },
    });
    expect(resetResp.ok()).toBeTruthy();

    // Verify initial status is 0 enrolled faces
    const statusResp0 = await request.get('/api/vision/status', {
      headers: { Authorization: `Bearer ${adminSession.token}` },
    });
    const status0 = await statusResp0.json();
    expect(status0.enrolledFacesCount).toBe(0);

    // 2. Verify Viewer RBAC: viewer cannot seed demo gallery
    const viewerLogin = await request.post('/api/auth/login', { data: { username: 'viewer', password: viewerPassword } });
    expect(viewerLogin.ok()).toBeTruthy();
    const viewerSession = await viewerLogin.json();

    const viewerSeedResp = await request.post('/api/vision/demo-enroll', {
      headers: { Authorization: `Bearer ${viewerSession.token}` },
    });
    expect(viewerSeedResp.status()).toBe(403);

    // 3. Authenticate browser page as investigator
    const invLogin = await request.post('/api/auth/login', { data: { username: 'investigator', password: investigatorPassword } });
    expect(invLogin.ok()).toBeTruthy();
    const invSession = await invLogin.json();

    await page.addInitScript(value => sessionStorage.setItem('nexus.session', JSON.stringify(value)), invSession);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Investigation workspace', exact: true })).toBeVisible();

    // Navigate to Visual Identity tab
    const visionNavBtn = page.getByRole('button', { name: 'Visual Identity' });
    await expect(visionNavBtn).toBeVisible();
    await visionNavBtn.click();

    // Verify Visual Identity view is active
    await expect(page.getByRole('heading', { name: 'Visual Identity Search' })).toBeVisible();

    // Verify gallery counter shows 0
    await expect(page.getByText(/Enrolled identities in gallery:\s*0/i)).toBeVisible();

    // Verify empty gallery alert in left column
    await expect(page.getByText('Gallery Contains 0 Enrolled Faces')).toBeVisible();

    // Load Aariv CCTV probe fixture
    const aarivFixture = page.getByRole('button', { name: /Aariv Veylan \(Surveillance CCTV\)/i });
    await expect(aarivFixture).toBeVisible({ timeout: 10000 });
    await aarivFixture.click();

    // Execute search on empty gallery
    const searchBtn = page.getByRole('button', { name: 'Run Visual Identity Search' });
    await expect(searchBtn).toBeEnabled({ timeout: 10000 });
    await searchBtn.click();

    // Verify explicit EMPTY_GALLERY state is displayed (NOT NO_MATCH)
    await expect(page.getByText('NO REFERENCE IDENTITIES ENROLLED (EMPTY GALLERY)')).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(/currently, the gallery contains 0 enrolled identities/i)).toBeVisible();

    // Verify Seed button inside the empty gallery state is present
    const seedAndSearchBtn = page.getByRole('button', { name: /Seed Demo Gallery & Re-run Search/i });
    await expect(seedAndSearchBtn).toBeVisible();

    // Click Seed Demo Gallery & Re-run Search
    await seedAndSearchBtn.click();

    // Verify gallery counter increases immediately without page reload
    await expect(page.getByText(/Enrolled identities in gallery:\s*[1-9]/i)).toBeVisible({ timeout: 25000 });

    // Verify search automatically ran and candidate match is found
    await expect(page.getByText(/POTENTIAL IDENTITY MATCH/i)).toBeVisible({ timeout: 35000 });
    await expect(page.getByText(/Aariv Veyl[ae]n/i).first()).toBeVisible({ timeout: 15000 });

    // Verify candidate badge is CANDIDATE (not confirmed identity)
    await expect(page.getByText(/CANDIDATE/i).first()).toBeVisible();

    // Extract similarity value and verify it is >= 0.85
    const simLocator = page.locator('.font-mono.font-bold.text-white').first();
    await expect(simLocator).toBeVisible();
    const simText = await simLocator.innerText();
    const simVal = parseFloat(simText);
    console.log(`Runtime similarity score obtained for Aariv CCTV probe: ${simVal}`);
    expect(simVal).toBeGreaterThanOrEqual(0.85);

    // Confirm candidate match
    const confirmBtn = page.getByRole('button', { name: 'Confirm Match' }).first();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await expect(page.getByRole('heading', { name: 'Confirm Face Match' })).toBeVisible();
    const notesField = page.getByPlaceholder(/Visual match corroborated/i);
    await notesField.fill('E2E Test: Confirmed Aariv match after recovering from empty gallery.');

    await page.getByRole('button', { name: 'Submit CONFIRMED' }).click();

    // Verify decision appears in Decisions tab
    const decisionsTabBtn = page.getByRole('button', { name: /Decisions/i }).first();
    await decisionsTabBtn.click();
    await expect(page.getByText('CONFIRMED').first()).toBeVisible({ timeout: 10000 });
  });

  test('visual identity search: sample fixture → candidate detection → confirmation modal → history', async ({ page, request }, testInfo) => {
    const { adminPassword } = getCredentials();
    const response = await request.post('/api/auth/login', { data: { username: 'admin', password: adminPassword } });
    expect(response.ok()).toBeTruthy();
    const session = await response.json();
    await page.addInitScript(value => sessionStorage.setItem('nexus.session', JSON.stringify(value)), session);

    // Reset, Load Demo data and seed gallery via API for deterministic test state
    await request.post('/api/demo/reset', { headers: { Authorization: `Bearer ${session.token}` } });
    await request.post('/api/demo/load', { headers: { Authorization: `Bearer ${session.token}` } });
    await request.post('/api/vision/demo-enroll', { headers: { Authorization: `Bearer ${session.token}` } });

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Investigation workspace', exact: true })).toBeVisible();

    // Navigate to Visual Identity tab
    const visionNavBtn = page.getByRole('button', { name: 'Visual Identity' });
    await expect(visionNavBtn).toBeVisible();
    await visionNavBtn.click();

    await expect(page.getByRole('heading', { name: 'Visual Identity Search' })).toBeVisible();
    await expect(page.getByText('ADAFACE IR-101 + SCRFD')).toBeVisible();

    // Click on the 1-click bundled test fixture: Aariv Veylan (Surveillance CCTV)
    const aarivFixture = page.getByRole('button', { name: /Aariv Veylan \(Surveillance CCTV\)/i });
    await expect(aarivFixture).toBeVisible({ timeout: 10000 });
    await aarivFixture.click();

    // Click Run Visual Identity Search button
    const searchBtn = page.getByRole('button', { name: 'Run Visual Identity Search' });
    await expect(searchBtn).toBeEnabled({ timeout: 10000 });
    await searchBtn.click();

    // Verify search completed and candidate is visible
    await expect(page.getByText(/Aariv Veyl[ae]n/i).first()).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(/CANDIDATE/i).first()).toBeVisible();

    // Open Confirm Match modal
    const confirmBtn = page.getByRole('button', { name: 'Confirm Match' }).first();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await expect(page.getByRole('heading', { name: 'Confirm Face Match' })).toBeVisible();
    const notesField = page.getByPlaceholder(/Visual match corroborated/i);
    await notesField.fill('Browser E2E: Confirmed visual alignment on surveillance crop.');

    await page.getByRole('button', { name: 'Submit CONFIRMED' }).click();

    // Switch to Decisions tab to verify recorded decision
    const decisionsTabBtn = page.getByRole('button', { name: /Decisions/i }).first();
    await expect(decisionsTabBtn).toBeVisible();
    await decisionsTabBtn.click();
    await expect(page.getByText('CONFIRMED').first()).toBeVisible();

    // Return to Investigation and verify graph was NOT automatically merged
    await page.getByRole('button', { name: 'Investigation' }).click();
    await expect(page.getByRole('heading', { name: 'Investigation workspace', exact: true })).toBeVisible();
    await expect(page.locator('.stat').filter({ hasText: 'Entities' }).locator('.animated-count')).toHaveAttribute('aria-label', '146');

    expect(errors).toEqual([]);
  });
});
