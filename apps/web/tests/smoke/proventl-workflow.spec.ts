import { expect, test, type Page } from "@playwright/test";

test("desktop workflow predicts, applies threshold locally, and exposes CSV export", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop smoke only");

  let predictionRequestCount = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/predictions"
    ) {
      predictionRequestCount += 1;
    }
  });

  await runPredictionWorkflow(page);

  await expect(
    page.getByRole("heading", { name: /Prediction results for/i }),
  ).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

  await page.getByLabel("Threshold value").fill("0.90");
  await page.getByRole("button", { name: "Apply Threshold" }).click();
  await expect(page.getByText(/threshold 0\.90/i)).toBeVisible();
  await page.waitForTimeout(500);
  expect(predictionRequestCount).toBe(1);
});

test("mobile workflow stacks dashboard content without horizontal overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "mobile smoke only",
  );

  await page.setViewportSize({ height: 844, width: 390 });
  await runPredictionWorkflow(page);

  await expect(page.getByText(/peptides .* threshold 0\.95/i)).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByText(/Page 1 of/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Target Profile" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("unsupported target disables prediction with concise helper copy", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop smoke only");

  await mockUnsupportedTargetLookup(page);
  await page.goto("/");
  await page.getByLabel("Target protein search").fill("Q9Y6K9");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(
    page.getByText("Prediction is not available.", { exact: true }),
  ).toBeVisible();
});

async function runPredictionWorkflow(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: /P01133|EGFR/i })
    .first()
    .click({ timeout: 60_000 });
  await expect(page.getByText(/Prediction remains explicit/i)).toBeVisible();
  await page.getByRole("button", { name: "Predict" }).click();
}

async function mockUnsupportedTargetLookup(page: Page) {
  await page.route("**/api/targets/examples", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { count: 0, examples: [] },
    });
  });

  await page.route("**/api/targets/search?**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      json: {
        count: 0,
        normalized_query: url.searchParams.get("q") ?? "",
        query: url.searchParams.get("q") ?? "",
        results: [],
      },
    });
  });

  await page.route("**/api/targets/lookup?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        normalized_accession: "Q9Y6K9",
        prediction_eligible: false,
        query: "Q9Y6K9",
        state: "valid-but-not-available",
        target: {
          gene: "IKBKG",
          protein_name: "NF-kappa-B essential modulator",
          uniprot_id: "Q9Y6K9",
        },
      },
    });
  });
}
