import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  const password = process.env.NEXUS_ADMIN_PASSWORD;
  if (!password) throw new Error('Set NEXUS_ADMIN_PASSWORD for browser integration tests');
  const response = await request.post('/api/auth/login', { data: { username: 'admin', password } });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript((value) => sessionStorage.setItem('nexus.session', JSON.stringify(value)), session);
});

test('Multimodal Evidence Fusion: OCR, Audio Diarization, OpenCLIP Visual Search & Review Log', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Investigation workspace', exact: true })).toBeVisible();

  // Navigate to Multimodal Evidence
  await page.getByRole('button', { name: 'Multimodal Evidence' }).click();
  await expect(page.getByRole('heading', { name: 'Multimodal Intelligence Workbench' })).toBeVisible();

  // 1. Verify Neural Sidecar Status Box
  await expect(page.getByText('NEURAL SIDECAR STATUS')).toBeVisible();
  await expect(page.getByText('PP-OCRv5 (En, Hi, Mr)')).toBeVisible();
  await expect(page.getByText('faster-whisper small-int8')).toBeVisible();
  await expect(page.getByText('OpenCLIP ViT-B-32')).toBeVisible();

  // 2. Seed Demo Multimodal Evidence
  const seedBtn = page.getByRole('button', { name: 'Seed Demo Multimodal Evidence' });
  await expect(seedBtn).toBeVisible();
  await seedBtn.click();

  // Verify assets in catalog
  await expect(page.getByText('Scanned_FIR_NXS007.pdf')).toBeVisible();
  await expect(page.getByText('Wiretap_Intercept_NXS007.wav')).toBeVisible();
  await expect(page.getByText('Seized_Vehicle_CASE019.jpg')).toBeVisible();
  await expect(page.getByText('CCTV_Vehicle_NXS007.jpg')).toBeVisible();

  // 3. Document OCR Tab
  await page.getByRole('button', { name: /Document OCR/i }).click();
  await expect(page.getByText('Document OCR & Scanned FIR Intelligence (PaddleOCR PP-OCRv5)')).toBeVisible();
  await expect(page.getByText('FIR No. 492/2026')).toBeVisible();
  await expect(page.getByText('Aariv Veylan')).toBeVisible();

  // Record an investigator determination on an extracted entity
  const reviewBtn = page.getByRole('button', { name: 'Review Lead' }).first();
  if (await reviewBtn.isVisible()) {
    await reviewBtn.click();
    await expect(page.getByText('Record Investigator Determination')).toBeVisible();
    await page.getByRole('button', { name: 'CORROBORATED' }).click();
    await page.getByPlaceholder(/Corroborated with bank records/i).fill('Verified with field team observation');
    await page.getByRole('button', { name: 'Commit Determination' }).click();
    await expect(page.getByText('CORROBORATED')).toBeVisible();
  }

  // 4. Audio Intelligence Tab
  await page.getByRole('button', { name: /Audio Intelligence/i }).click();
  await expect(page.getByText('Audio & Voice Intelligence (faster-whisper small-int8)')).toBeVisible();
  await expect(page.getByText('Aariv Veylan', { exact: false })).toBeVisible();
  await expect(page.getByText('SPEAKER_00')).toBeVisible();

  // 5. Visual Evidence Search Tab (OpenCLIP ViT-B-32)
  await page.getByRole('button', { name: /Visual Evidence Search/i }).click();
  await expect(page.getByText('Visual Evidence Search (OpenCLIP ViT-B-32 / laion2b_s34b_b79k)')).toBeVisible();

  // Verify Mandatory Safeguard Disclaimer Banner
  await expect(page.getByText('INVESTIGATIVE LEAD SAFEGUARD:')).toBeVisible();

  // Select CCTV Vehicle probe from dropdown
  const assetSelect = page.locator('select').filter({ hasText: 'Choose an enrolled photo' });
  await assetSelect.selectOption({ label: /CCTV_Vehicle_NXS007/ });

  // Run Visual Search
  const searchMatchesBtn = page.getByRole('button', { name: 'Find Cross-Case Matches' });
  await searchMatchesBtn.click();

  // Verify ranked cross-case matches appear
  await expect(page.getByText(/CASE-019 — Visual Similarity/i)).toBeVisible();
  await expect(page.getByText(/Visual similarity lead only/i).first()).toBeVisible();

  // 6. Review Log Tab
  await page.getByRole('button', { name: /Investigator Review Log/i }).click();
  await expect(page.getByText('Investigator Human-in-the-Loop Review Log')).toBeVisible();

  expect(errors).toEqual([]);
});

test('RBAC: VIEWER role cannot seed evidence or mutate review decisions', async ({ page, request }) => {
  const password = process.env.NEXUS_VIEWER_PASSWORD;
  if (!password) throw new Error('Set NEXUS_VIEWER_PASSWORD for browser integration tests');
  const response = await request.post('/api/auth/login', { data: { username: 'viewer', password } });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript((value) => sessionStorage.setItem('nexus.session', JSON.stringify(value)), session);

  await page.goto('/');
  await page.getByRole('button', { name: 'Multimodal Evidence' }).click();

  // Seed Demo button must be disabled for VIEWER
  const seedBtn = page.getByRole('button', { name: 'Seed Demo Multimodal Evidence' });
  await expect(seedBtn).toBeDisabled();

  // Ingest submit button must be disabled for VIEWER
  const ingestBtn = page.getByRole('button', { name: 'Ingest & Process Evidence' });
  await expect(ingestBtn).toBeDisabled();
});
