import { expect, test } from "@playwright/test";

const officialIpbLogoUrl =
  "https://www.ipb.ac.id/wp-content/uploads/2023/12/Logo-IPB-University_Horizontal.png";

test("header uses the official IPB University website logo", async ({
  page,
}) => {
  await page.goto("/");

  const logoLink = page.getByRole("link", { name: "IPB University" });
  await expect(logoLink).toHaveAttribute("href", "https://www.ipb.ac.id/");
  await expect(logoLink).toHaveAttribute("target", "_blank");
  await expect(logoLink).toHaveAttribute("rel", /noopener/);
  await expect(logoLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await expect(
    logoLink.getByRole("img", { name: "IPB University" }),
  ).toHaveAttribute("src", officialIpbLogoUrl);
});
