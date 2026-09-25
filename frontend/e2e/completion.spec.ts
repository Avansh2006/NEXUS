import { test, expect } from "@playwright/test";

test("session gate, role controls and expired download", async ({ page }) => {
  await page.route("**/api/quality", (r) =>
    r.fulfill({ json: { precision: 1, recall: 1, samples: 0, scope: "Mock session test" } }),
  );
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { username: "viewer", role: "VIEWER" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to NEXUS" }),
  ).toBeVisible();
  await page.route("**/api/auth/login", (r) =>
    r.fulfill({
      json: {
        token: "test",
        username: "viewer",
        role: "VIEWER",
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      },
    }),
  );
  await page.route("**/api/graph", (r) =>
    r.fulfill({
      json: {
        nodes: [],
        edges: [],
        evidence: [],
        records: [],
        analysis: {},
        analyzed: false,
        suggestions: [],
      },
    }),
  );
  await page.route("**/api/workflow", (r) =>
    r.fulfill({ json: { notes: [], watchlist: [], triage: [] } }),
  );
  await page.getByLabel("Username").fill("viewer");
  await page.getByLabel("Password").fill("test");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Investigation workspace", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset demo data" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Analyze Network", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page.route("**/api/exports/nodes.csv", (r) =>
    r.fulfill({ status: 401, json: { error: { message: "Expired" } } }),
  );
  await page.getByRole("button", { name: "Download nodes CSV" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to NEXUS" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your session expired. Sign in again."),
  ).toBeVisible();
});

test("persistent workflow, narrative source, simulation, playback and exports", async ({
  page,
  request,
}) => {
  const password = process.env.NEXUS_ADMIN_PASSWORD;
  test.skip(!password, "Requires configured synthetic test account");
  const auth = await request.post("/api/auth/login", {
    data: { username: "admin", password },
  });
  expect(auth.ok()).toBeTruthy();
  const session = await auth.json();
  const headers = { Authorization: `Bearer ${session.token}` };
  await request.post("/api/demo/reset", { headers, data: {} });
  expect(
    (await request.post("/api/demo/load", { headers, data: {} })).ok(),
  ).toBeTruthy();
  expect(
    (await request.post("/api/analyze", { headers, data: {} })).ok(),
  ).toBeTruthy();
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search entities" })
    .fill("SYN-PHONE-001");
  await page.locator(".search-results").getByRole("button").first().click();
  const note = `Synthetic review ${Date.now()}`;
  await page.getByLabel("New entity note").fill(note);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.locator(".entity-note")).toContainText([note]);
  await page
    .getByRole("button", { name: "Add to watchlist", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove from watchlist", exact: true }),
  ).toBeVisible();
  const before = await (await request.get("/api/graph", { headers })).json();
  await page
    .getByRole("button", { name: "Simulate removal", exact: true })
    .click();
  await expect(page.getByText(/edges removed virtually/)).toBeVisible();
  expect(await (await request.get("/api/graph", { headers })).json()).toEqual(
    before,
  );
  await page.getByLabel("Playback instant", { exact: true }).fill("0");
  await expect(
    page.getByRole("button", { name: "Play playback" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all events" }).click();
  await page.getByRole("button", { name: "Alerts", exact: true }).click();
  const status = page.getByRole("combobox", { name: /Review status / }).first();
  await status.selectOption("Under Review");
  await expect(status).toHaveValue("Under Review");
  await page.reload();
  await page.getByRole("button", { name: "Alerts", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: /Review status / }).first(),
  ).toHaveValue("Under Review");
  await page
    .getByRole("button", { name: "Investigation", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search entities" })
    .fill("SYN-PHONE-001");
  await page.locator(".search-results").getByRole("button").first().click();
  await expect(
    page.locator(".entity-note").filter({ hasText: note }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove from watchlist", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Data Ingestion", exact: true })
    .click();
  await page.getByLabel("Record type").selectOption("intel-report");
  await page.locator("textarea").fill(
    JSON.stringify([
      {
        caseId: `NXS-TEST-${Date.now()}`,
        date: "2026-09-23T00:00:00Z",
        text: "Phone SYN-PHONE-001 observed. Instagram handle @synthetic_review.",
        sourceReliability: "B",
        informationCredibility: 2,
      },
    ]),
  );
  await page
    .getByRole("button", { name: "Ingest records", exact: true })
    .click();
  await expect(page.locator(".ingest-result")).toContainText("1 accepted");
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  for (const name of [
    "Download nodes CSV",
    "Download edges CSV",
    "Download GraphML",
  ]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/^NEXUS-/);
  }
  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  await page.getByRole("button", { name: "Refresh diagnostics" }).click();
  await expect(page.getByText("Database", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to NEXUS" }),
  ).toBeVisible();
});

test("manual playback reveals dated events including reduced motion and mobile", async ({
  page,
}) => {
  await page.route("**/api/quality", r=>r.fulfill({status:503,json:{error:{message:"Fixture quality unavailable"}}}));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const properties = { caseIds: ["CASE-1"], evidenceIds: [] };
  const nodes = ["A", "B", "C"].map((id) => ({
    id,
    type: "Person",
    label: id,
    properties,
  }));
  const edges = [
    ["ab", "A", "B", "2026-01-01T00:00:00Z"],
    ["bc", "B", "C", "2026-01-02T00:00:00Z"],
  ].map(([id, source, target, timestamp]) => ({
    id,
    source,
    target,
    type: "CONTACT",
    properties: {
      ...properties,
      firstSeen: timestamp,
      lastSeen: timestamp,
      events: [{ timestamp, evidenceId: id, amount: 0 }],
    },
  }));
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "nexus.session",
      JSON.stringify({
        token: "test",
        username: "viewer",
        role: "VIEWER",
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      }),
    ),
  );
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { username: "viewer", role: "VIEWER" } }),
  );
  await page.route("**/api/graph", (r) =>
    r.fulfill({
      json: {
        nodes,
        edges,
        evidence: [],
        records: [],
        analysis: {},
        analyzed: true,
        suggestions: [],
      },
    }),
  );
  await page.route("**/api/workflow", (r) =>
    r.fulfill({ json: { notes: [], watchlist: [], triage: [] } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".timeline-event")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Play playback" }),
  ).toBeVisible();
  await page
    .getByRole("slider", { name: "Playback instant", exact: true })
    .fill("0");
  await expect(page.locator(".timeline-event")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Show all events", exact: true })
    .click();
  await expect(page.locator(".timeline-event")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("slider", { name: "Playback instant", exact: true }),
  ).toBeVisible();
});

test("quality does not invent missing F1 and audit verification reports failure", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "nexus.session",
      JSON.stringify({
        token: "test",
        username: "viewer",
        role: "VIEWER",
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      }),
    ),
  );
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { username: "viewer", role: "VIEWER" } }),
  );
  await page.route("**/api/graph", (r) =>
    r.fulfill({
      json: {
        nodes: [],
        edges: [],
        evidence: [],
        records: [],
        analysis: {},
        analyzed: false,
        suggestions: [],
      },
    }),
  );
  await page.route("**/api/workflow", (r) =>
    r.fulfill({ json: { notes: [], watchlist: [], triage: [] } }),
  );
  await page.route("**/api/quality", (r) =>
    r.fulfill({
      json: {
        precision: 0.8,
        recall: 0.5,
        samples: 3,
        scope: "Synthetic exact-span evaluation",
        multilingualSynthetic: {
          samples: 2,
          strictPrecision: 1,
          strictRecall: 0.5,
          strictF1: 2 / 3,
          truePositives: 1,
          falsePositives: 0,
          falseNegatives: 1,
          scope: "Separate synthetic Hindi/Hinglish fixtures",
        },
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".quality")).not.toContainText("67.3");
  await expect(page.locator(".quality")).toContainText("Unavailable");
  await expect(
    page.getByText("Synthetic Hindi/Hinglish fixtures", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/audit", (r) =>
    r.fulfill({
      json: [
        {
          id: 1,
          action: "entity:note",
          userId: "investigator",
          createdAt: "2026-09-23T00:00:00Z",
        },
      ],
    }),
  );
  await page.route("**/api/audit/verify", (r) =>
    r.fulfill({
      json: { valid: false, brokenAtIndex: 0, reason: "Hash linkage mismatch" },
    }),
  );
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page.getByRole("button", { name: "Refresh audit trail" }).click();
  await expect(page.locator(".audit-row")).toContainText("investigator");
  await page.getByRole("button", { name: "Verify audit chain" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Audit chain verification failed",
  );
  await page.route("**/api/audit/verify", (r) =>
    r.fulfill({
      status: 503,
      json: { error: { message: "Service unavailable" } },
    }),
  );
  await page.getByRole("button", { name: "Verify audit chain" }).click();
  await expect(page.getByRole("alert")).toContainText("Service unavailable");
});


test("malformed stored sessions return to sign in with synthetic banner",async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem("nexus.session","{}"));
 await page.goto("/");
 await expect(page.getByRole("heading",{name:"Sign in to NEXUS"})).toBeVisible();
 await expect(page.getByText("PROTOTYPE \u2014 SYNTHETIC DATA",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem("nexus.session"))).toBeNull();
});
