import {
  BookOpen,
  FlaskConical,
  Github,
  Home,
  Layers,
  Quote,
} from "lucide-react";
import type { ReactNode } from "react";

import { APP_NAVIGATION, type AppRoute } from "../routes";

type NavigationItem = {
  label: string;
  route: AppRoute;
  icon: typeof Home;
};

const navigationIcons: Record<AppRoute, typeof Home> = {
  batch: Layers,
  citation: Quote,
  docs: BookOpen,
  home: Home,
  methodology: FlaskConical,
};

const PROVENTL_LOGO_URL = "/brand/proventl-logo.svg";

type AppShellProps = {
  activeRoute: AppRoute;
  children: ReactNode;
  pageTitle: string;
  onRouteChange: (route: AppRoute) => void;
};

const IPB_UNIVERSITY_LOGO_URL =
  "https://www.ipb.ac.id/wp-content/uploads/2023/12/Logo-IPB-University_Horizontal.png";

export function AppShell({
  activeRoute,
  children,
  pageTitle,
  onRouteChange,
}: AppShellProps) {
  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-slate-50 font-sans text-fg antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-slate-50 bg-proventl-radial"
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1150px] flex-col px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-5 pb-10 pt-1 max-sm:items-center max-sm:text-center sm:pb-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5 max-sm:flex-col max-sm:gap-3">
            <a
              href="https://www.ipb.ac.id/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="IPB University"
              className="inline-flex no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ipb-blue"
            >
              <img
                src={IPB_UNIVERSITY_LOGO_URL}
                alt="IPB University"
                className="h-10 w-auto sm:h-12"
              />
            </a>
            <div className="hidden h-8 w-px bg-ipb-blue/15 sm:block" />
            <button
              type="button"
              onClick={() => onRouteChange("home")}
              className="flex items-center gap-3 text-left font-display text-[1.125rem] font-extrabold leading-tight text-ipb-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ipb-blue max-sm:justify-center"
              aria-label="Go to ProVenTL home"
            >
              <img
                src={PROVENTL_LOGO_URL}
                alt=""
                className="h-14 w-auto flex-none"
              />
              <span className="flex flex-col">
                ProVenTL
                <span className="text-xs font-medium text-muted">
                  Venom Interaction Analysis
                </span>
              </span>
            </button>
          </div>

          <nav
            aria-label="Primary navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 max-sm:justify-center"
          >
            {APP_NAVIGATION.map((item) => {
              const Icon = navigationIcons[item.route];
              const isActive = activeRoute === item.route;

              return (
                <button
                  key={item.route}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onRouteChange(item.route)}
                  className={[
                    "inline-flex items-center gap-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipb-blue",
                    isActive
                      ? "text-ipb-blue"
                      : "text-muted hover:text-ipb-blue",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
            <a
              href="https://github.com/ghiffaribraviah/proventl-website"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-ipb-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipb-blue"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              GitHub
            </a>
          </nav>
        </header>

        <main aria-label={pageTitle} className="flex-1">
          {children}
        </main>

        <footer className="mt-24 border-t border-black/[0.05] py-12 text-center text-sm text-muted max-sm:px-2">
          <p>&copy; 2026 ProVenTL Framework. Based on Adhiva et al. 2026.</p>
          <p className="mt-2 font-bold text-ipb-blue">
            Computational prediction only; experimental validation is required.
          </p>
        </footer>
      </div>
    </div>
  );
}
