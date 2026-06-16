import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI Mock Interview — Practice Real Interviews with AI" },
      { name: "description", content: "AI Mock Interview platform. Upload your resume, practice with a video & voice AI interviewer, and get detailed feedback." },
      { property: "og:title", content: "AI Mock Interview — Practice Real Interviews with AI" },
      { property: "og:description", content: "AI Mock Interview platform. Upload your resume, practice with a video & voice AI interviewer, and get detailed feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI Mock Interview — Practice Real Interviews with AI" },
      { name: "twitter:description", content: "AI Mock Interview platform. Upload your resume, practice with a video & voice AI interviewer, and get detailed feedback." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36ae433d-55c3-4fbd-b4b3-041c65739f61/id-preview-2c1b7355--aeedd5d9-aae1-4574-83e6-dc003d02cf55.lovable.app-1776588975194.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36ae433d-55c3-4fbd-b4b3-041c65739f61/id-preview-2c1b7355--aeedd5d9-aae1-4574-83e6-dc003d02cf55.lovable.app-1776588975194.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
