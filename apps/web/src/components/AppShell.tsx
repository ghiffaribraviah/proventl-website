import { BookOpen, FlaskConical, Github, Home, Quote } from "lucide-react";
import type { ReactNode } from "react";

import { APP_NAVIGATION, type AppRoute } from "../routes";

type NavigationItem = {
  label: string;
  route: AppRoute;
  icon: typeof Home;
};

const navigationIcons: Record<AppRoute, typeof Home> = {
  citation: Quote,
  docs: BookOpen,
  home: Home,
  methodology: FlaskConical,
};

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
    <div className="relative isolate min-h-screen overflow-x-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-slate-50 bg-proventl-radial"
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1150px] flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="flex flex-col gap-5 pb-8 pt-2 max-sm:items-center max-sm:text-center sm:pb-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 max-sm:justify-center sm:gap-5">
            <a
              href="https://www.ipb.ac.id/"
              target="_blank"
              rel="noopener"
              className="inline-flex h-12 shrink-0 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipb-blue"
            >
              <img
                src={IPB_UNIVERSITY_LOGO_URL}
                alt="IPB University"
                className="h-8 w-auto max-w-[132px]"
              />
            </a>
            <div className="hidden h-8 w-px bg-ipb-blue/15 sm:block" />
            <button
              type="button"
              onClick={() => onRouteChange("home")}
              className="flex flex-col text-left font-display text-[1.125rem] font-extrabold leading-tight text-ipb-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ipb-blue"
              aria-label="Go to ProVenTL home"
            >
              ProVenTL
              <span className="text-xs font-medium text-slate-500">
                Venom Interaction Analysis
              </span>
            </button>
          </div>

          <nav
            aria-label="Primary navigation"
            className="flex flex-wrap gap-2 max-sm:w-full max-sm:justify-center"
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
                    "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipb-blue",
                    isActive
                      ? "bg-white/85 text-ipb-blue shadow-[0_4px_16px_rgba(38,60,146,0.08)] ring-1 ring-white/70"
                      : "text-slate-500 hover:bg-white/55 hover:text-ipb-blue",
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
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-500 transition hover:bg-white/55 hover:text-ipb-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipb-blue"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              GitHub
            </a>
          </nav>
        </header>

        <main aria-label={pageTitle} className="flex-1">
          {children}
        </main>

        <footer className="mt-12 border-t border-white/70 py-6 text-center text-sm text-slate-500">
          <div className="flex flex-col items-center justify-center gap-3">
            <p>
              ProVenTL is a computational research tool. Classifier scores are 
              predictions and require experimental validation.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
