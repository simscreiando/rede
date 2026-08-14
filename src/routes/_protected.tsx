import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchAuthContext } from "@/server/auth-context.functions";

// Este arquivo é a correção do problema mais grave encontrado na auditoria
// do projeto anterior: proteção de rota real, no servidor, via beforeLoad —
// não um componente React que só decide o que renderizar depois que a
// página já carregou. Toda rota protegida vive como filha deste layout
// (arquivo prefixado com "_", que o TanStack Router trata como "pathless":
// não aparece na URL, só agrupa beforeLoad + Outlet).
//
// beforeLoad roda no servidor na primeira carga de uma rota (inclusive
// acesso direto por URL) e no cliente nas navegações seguintes — cobre os
// dois casos exigidos pela spec (Teste E e Teste F).
export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ location }) => {
    const ctx = await fetchAuthContext();

    if (ctx.status === "anonymous") {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    if (ctx.status === "beta_unauthorized") {
      throw redirect({ to: "/acesso-restrito" });
    }

    if (ctx.status === "needs_adult_confirmation" && location.pathname !== "/confirmar-idade") {
      throw redirect({ to: "/confirmar-idade" });
    }

    return { auth: ctx };
  },
  component: () => <Outlet />,
});
