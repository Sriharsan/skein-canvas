import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-thread mb-4">Loose thread</p>
        <h1 className="font-serif text-5xl md:text-6xl text-bone">404</h1>
        <svg viewBox="0 0 240 40" className="mx-auto mt-6 w-56 opacity-70" aria-hidden="true">
          <path d="M0 20 Q60 0 120 20 T240 20" fill="none" stroke="var(--thread)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="0" cy="20" r="2" fill="var(--thread)" />
          <circle cx="240" cy="20" r="2" fill="var(--thread)" />
        </svg>
        <p className="mt-6 text-sm text-muted-foreground">
          This thread doesn't lead anywhere. The page you were looking for isn't woven in.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Link to="/" className="inline-flex items-center rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
            Back home
          </Link>
          <Link to="/build" className="inline-flex items-center rounded-sm border border-border px-4 py-2 text-sm hover:bg-secondary">
            Open the canvas
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl text-foreground">Something snapped.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Unexpected error."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            Try again
          </button>
          <a href="/" className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-secondary">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Skein — Weave your client pipeline" },
      { name: "description", content: "A visual workflow canvas for freelancers. Drag, connect, and automate client intake without code." },
      { property: "og:title", content: "Skein — Weave your client pipeline" },
      { property: "og:description", content: "Visual automation for solo operators. Nodes as woven tags, threads as edges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Archivo:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
