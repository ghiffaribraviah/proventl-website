export type AppRoute = "citation" | "docs" | "home" | "methodology";

export const APP_NAVIGATION: Array<{ label: string; route: AppRoute }> = [
  { label: "Home", route: "home" },
  { label: "Docs", route: "docs" },
  { label: "Methodology", route: "methodology" },
  { label: "Citation", route: "citation" },
];

export function pathForRoute(route: AppRoute): string {
  switch (route) {
    case "docs":
      return "/docs";
    case "methodology":
      return "/docs/methodology";
    case "citation":
      return "/docs/citation";
    case "home":
      return "/";
  }
}

export function routeFromPath(pathname: string): AppRoute {
  switch (pathname.replace(/\/+$/, "") || "/") {
    case "/docs":
      return "docs";
    case "/docs/methodology":
      return "methodology";
    case "/docs/citation":
      return "citation";
    default:
      return "home";
  }
}
