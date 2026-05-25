import { expect, test, type Page } from "@playwright/test";

test("search results do not resize the radial page background", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop smoke only");

  await mockTargetSearch(page);
  await page.goto("/");

  const initialBackground = await measureRadialBackground(page);
  expect(initialBackground.position).toBe("fixed");
  expect(initialBackground.height).toBe(page.viewportSize()?.height);

  await page.getByLabel("Target protein search").fill("ca");
  await expect(page.getByText("Mock target 11")).toBeVisible();

  const expandedBackground = await measureRadialBackground(page);
  expect(expandedBackground.position).toBe("fixed");
  expect(expandedBackground.height).toBe(initialBackground.height);
  expect(expandedBackground.top).toBe(0);
});

async function mockTargetSearch(page: Page) {
  await page.route("**/api/targets/examples", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { count: 0, examples: [] },
    });
  });

  await page.route("**/api/targets/search?q=ca", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        count: 12,
        normalized_query: "ca",
        query: "ca",
        results: Array.from({ length: 12 }, (_, index) => ({
          gene: `CA${index}`,
          organism: "Homo sapiens",
          protein_name: `Mock target ${index}`,
          uniprot_id: `P${String(index).padStart(5, "0")}`,
        })),
      },
    });
  });
}

async function measureRadialBackground(page: Page) {
  return page.evaluate(() => {
    const background = document.querySelector(".bg-proventl-radial");
    if (!(background instanceof HTMLElement)) {
      throw new Error("Expected a ProVenTL radial background layer.");
    }

    const rect = background.getBoundingClientRect();
    return {
      height: rect.height,
      position: window.getComputedStyle(background).position,
      top: rect.top,
    };
  });
}
