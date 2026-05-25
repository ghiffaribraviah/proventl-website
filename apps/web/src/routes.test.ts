import { describe, expect, it } from "vitest";

import { APP_NAVIGATION, pathForRoute, routeFromPath } from "./routes";

describe("app documentation routes", () => {
  it("maps V1 docs routes", () => {
    expect(pathForRoute("docs")).toBe("/docs");
    expect(pathForRoute("methodology")).toBe("/docs/methodology");
    expect(pathForRoute("citation")).toBe("/docs/citation");
    expect(routeFromPath("/docs/methodology")).toBe("methodology");
  });

  it("navigation reaches docs routes without API docs", () => {
    expect(APP_NAVIGATION.map((item) => pathForRoute(item.route))).toEqual([
      "/",
      "/docs",
      "/docs/methodology",
      "/docs/citation",
    ]);
    expect(APP_NAVIGATION.some((item) => item.label.includes("API"))).toBe(false);
    expect(routeFromPath("/docs/api")).toBe("home");
  });
});
