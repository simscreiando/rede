// Configuração central de variáveis de ambiente públicas.
// Nenhum domínio é hardcoded em nenhum outro arquivo do projeto — tudo
// referencia PUBLIC_APP_URL. Trocar de domínio (ex.: preview da Vercel para
// produção) é só trocar essa variável, sem tocar em código.

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Configure-a no .env (veja .env.example) ` +
        `ou nas variáveis de ambiente do projeto na Vercel.`,
    );
  }
  return value;
}

export const APP_NAME = "Saudade Social";

export const PUBLIC_APP_URL = requirePublicEnv(
  "VITE_PUBLIC_APP_URL",
  import.meta.env["VITE_PUBLIC_APP_URL"] ?? process.env["PUBLIC_APP_URL"],
);

export const AUTH_CALLBACK_URL = buildCallbackUrl(PUBLIC_APP_URL);

/** Extraída como função pura só para ser testável sem precisar do Vite runtime. */
export function buildCallbackUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/auth/callback`;
}
