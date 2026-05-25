import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./components/AppShell";
import { CitationPage } from "./pages/CitationPage";
import { DocsPage } from "./pages/DocsPage";
import { HomePage } from "./pages/HomePage";
import { MethodologyPage } from "./pages/MethodologyPage";
import { pathForRoute, routeFromPath, type AppRoute } from "./routes";

const routeLabels: Record<AppRoute, string> = {
  home: "Home",
  docs: "Docs",
  methodology: "Methodology",
  citation: "Citation",
};

export function App() {
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() =>
    routeFromPath(window.location.pathname),
  );

  const title = useMemo(() => routeLabels[activeRoute], [activeRoute]);

  useEffect(() => {
    function handlePopState() {
      setActiveRoute(routeFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleRouteChange(route: AppRoute) {
    setActiveRoute(route);
    window.history.pushState(null, "", pathForRoute(route));
  }

  return (
    <AppShell
      activeRoute={activeRoute}
      pageTitle={title}
      onRouteChange={handleRouteChange}
    >
      {activeRoute === "home" ? <HomePage /> : null}
      {activeRoute === "docs" ? <DocsPage /> : null}
      {activeRoute === "methodology" ? <MethodologyPage /> : null}
      {activeRoute === "citation" ? <CitationPage /> : null}
    </AppShell>
  );
}
