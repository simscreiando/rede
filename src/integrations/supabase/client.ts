// Client Supabase do NAVEGADOR — usa cookies (via @supabase/ssr), não
// localStorage. Isso é o que permite que o servidor (SSR, em
// beforeLoad/server functions) leia a mesma sessão na primeira renderização
// de uma rota, sem depender de JS já ter rodado no cliente. É o padrão
// oficial documentado pelo Supabase para TanStack Start — ver
// docs/ARQUITETURA_AUTH.md para a explicação completa de por que isso
// mudou depois da Fase 0.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

function createSupabaseBrowserClient() {
  const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(
      `Variável(is) de ambiente do Supabase ausente(s): ${missing.join(", ")}. ` +
        `Configure no .env (veja .env.example).`,
    );
  }

  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

let _supabase: ReturnType<typeof createSupabaseBrowserClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseBrowserClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseBrowserClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
