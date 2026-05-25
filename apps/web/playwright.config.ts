import { defineConfig, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, "../..");
const smokeDataDir = path.join(repoRoot, ".playwright-data");

mkdirSync(smokeDataDir, { recursive: true });

export default defineConfig({
  expect: {
    timeout: 30_000,
  },
  testDir: "./tests/smoke",
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "uv run uvicorn proventl_api.app:app --app-dir apps/api/src --host 127.0.0.1 --port 8000",
      cwd: repoRoot,
      env: {
        PROVENTL_APP_DATA_DIR: smokeDataDir,
        PROVENTL_MODEL_PATH: path.join(repoRoot, "model/best_model_auc_0.8748.h5"),
        PROVENTL_PEPTIDE_EMBEDDINGS_PATH: path.join(
          repoRoot,
          "model/data_testing/Pep_Ular_ProtT5.csv",
        ),
        PROVENTL_PROTEIN_EMBEDDINGS_PATH: path.join(
          repoRoot,
          "model/data_testing/Prot_Cancer_ProtT5.csv",
        ),
        PROVENTL_TARGET_METADATA_PATH: path.join(
          repoRoot,
          "model/data_testing/data_protein_kanker_uniprot.csv",
        ),
      },
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:8000/api/health/ready",
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      cwd: webRoot,
      env: {
        VITE_API_PROXY_TARGET: "http://127.0.0.1:8000",
      },
      reuseExistingServer: true,
      timeout: 60_000,
      url: "http://127.0.0.1:5173",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
