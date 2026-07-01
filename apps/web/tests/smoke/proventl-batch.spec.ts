import { expect, test, type Page } from "@playwright/test";

test("batch builder, run, summary, and drill-in via the real backend", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop smoke only");

  await page.goto("/batch");
  await expect(
    page.getByRole("heading", { name: "Batch Prediction Dashboard" }),
  ).toBeVisible();

  await addTargetsViaPaste(page, ["P01133", "P00749", "P04637"]);

  await expect(page.getByText("Targets in batch (3 / 50)")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove P01133 from batch" }),
  ).toBeVisible();

  let batchRequestCount = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/predictions/batch"
    ) {
      batchRequestCount += 1;
    }
  });

  await page.getByRole("button", { name: "Run Batch Prediction" }).click();

  await expect(
    page.getByRole("heading", { name: "Batch Results" }),
  ).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText(/3 of 3 targets predicted/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export Batch CSV" }),
  ).toBeVisible();

  const summaryRow = page
    .getByRole("row", { name: /Open P01133 detail/i })
    .first();
  await summaryRow.click();
  await expect(
    page.getByRole("button", { name: "Back to batch" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Target Profile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Prediction results for/i }),
  ).toBeVisible();
  expect(batchRequestCount).toBe(1);
});

test("batch with a rejected accession surfaces the rejected report", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop smoke only");

  await page.goto("/batch");
  await addTargetsViaPaste(page, ["P01133", "P99999", "BAD"]);

  await page.getByRole("button", { name: "Run Batch Prediction" }).click();

  await expect(
    page.getByRole("heading", { name: "Batch Results" }),
  ).toBeVisible({ timeout: 180_000 });
  await expect(
    page.getByText("Some targets could not be scored"),
  ).toBeVisible();
  await expect(page.getByText(/1 of 3 targets predicted/i)).toBeVisible();
});

test("batch CSV export downloads a combined file with target identity columns", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop smoke only");

  await page.goto("/batch");
  await addTargetsViaPaste(page, ["P01133", "P00749"]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Run Batch Prediction" }).click();
  await expect(
    page.getByRole("heading", { name: "Batch Results" }),
  ).toBeVisible({ timeout: 180_000 });

  await page.getByRole("button", { name: "Export Batch CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "proventl_batch_2targets_threshold-0.95.csv",
  );

  const path = await download.path();
  if (!path) {
    throw new Error("expected batch CSV download to be captured");
  }
  const { readFile } = await import("node:fs/promises");
  const csv = await readFile(path, "utf-8");
  const [header] = csv.split("\n");
  expect(header).toBe(
    "target_uniprot_id,target_gene,target_protein_name,target_organism,target_sequence,rank,peptide_id,peptide_sequence,peptide_source_protein,classifier_score,applied_threshold,classification",
  );
  expect(csv).toMatch(/^P01133,/m);
  expect(csv).toMatch(
    /^P01133,EGF,Pro-epidermal growth factor,Homo sapiens,MLLTLI/m,
  );
  expect(csv).toMatch(/^P00749,/m);
});

async function addTargetsViaPaste(page: Page, accessions: string[]) {
  await page.getByRole("tab", { name: "Paste / Upload List" }).click();
  const textarea = page.getByLabel("Paste UniProt accessions");
  await textarea.fill(accessions.join(", "));
  await page.getByRole("button", { name: "Add List" }).click();
}
