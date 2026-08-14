import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { APP_NAME, PUBLIC_APP_URL } from "@/lib/env";
import appCss from "@/styles.css?url";

type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${APP_NAME} — a saudade daquela internet, com as regras de hoje` },
      {
        name: "description",
        content:
          "Saudade Social é uma rede social própria, com nostalgia da Web 2.0, comunidades, " +
          "amizades e privacidade incorporada ao produto. Não é um clone de nenhuma outra rede.",
      },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:url", content: PUBLIC_APP_URL },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
