import { describe, expect, it } from "vitest";

import { APP_NAVIGATION, pathForRoute, routeFromPath } from "./routes";

describe("app documentation routes", () => {
  it("maps V1 docs routes", () => {
    expect(pathForRoute("docs")).toBe("/docs");
    expect(pathForRoute("methodology")).toBe("/docs/methodology");
    expect(pathForRoute("citation")).toBe("/docs/citation");
    expect(routeFromPath("/docs/methodology")).toBe("methodology");
  });

  it("maps the V2 batch route", () => {
    expect(pathForRoute("batch")).toBe("/batch");
    expect(routeFromPath("/batch")).toBe("batch");
  });

  it("navigation reaches docs routes and the batch route without API docs", () => {
    expect(APP_NAVIGATION.map((item) => pathForRoute(item.route))).toEqual([
      "/",
      "/batch",
      "/docs",
      "/docs/methodology",
      "/docs/citation",
    ]);
    expect(APP_NAVIGATION.some((item) => item.label.includes("API"))).toBe(false);
    expect(routeFromPath("/docs/api")).toBe("home");
  });
});
