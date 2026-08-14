import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AUTH_CALLBACK_URL } from "@/lib/env";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

// Mensagem única para qualquer rejeição ligada ao closed beta — nunca diz
// se o problema foi "e-mail não autorizado" especificamente, para não virar
// um oráculo de enumeração (achado da auditoria, item 4). O Postgres error
// vindo do Auth Hook (migration 0007) tem sempre este texto; qualquer outro
// erro do Supabase (senha fraca, e-mail mal formado etc.) é mostrado como
// veio, porque esses não revelam nada sobre a lista de autorizados.
const BETA_BLOCK_MESSAGE = "Este acesso está restrito durante a fase de testes da Saudade Social.";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    // A confirmação de 18+ para o fluxo Google NÃO acontece aqui (o
    // consentimento do Google não tem esse campo) — acontece depois do
    // callback, na tela /confirmar-idade, do mesmo jeito que para quem
    // entra por e-mail. Ver _protected.tsx.
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: AUTH_CALLBACK_URL },
    });
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (mode === "signup") {
      if (!isAdult) {
        setError("É preciso confirmar que você tem 18 anos ou mais para se cadastrar.");
        setSubmitting(false);
        return;
      }
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      setSubmitting(false);
      if (signUpError) {
        // O Auth Hook (Before User Created) rejeita e-mails não autorizados
        // durante o closed beta com a mensagem padronizada abaixo — mostrada
        // como está, sem revelar mais detalhes.
        setError(signUpError.message || BETA_BLOCK_MESSAGE);
        return;
      }
      void navigate({ to: "/perfil" });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    void navigate({ to: "/perfil" });
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold mb-2">
        {mode === "login" ? "Entrar" : "Criar conta"}
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        A Saudade Social está em fase de testes fechados — só e-mails convidados conseguem entrar.
      </p>

      <button
        type="button"
        onClick={() => void handleGoogle()}
        className="w-full rounded-md border border-border px-4 py-2 text-sm mb-6"
      >
        Entrar com Google
      </button>

      <div className="text-center text-xs text-muted-foreground mb-6">ou</div>

      <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-sm mb-1" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        {mode === "signup" && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAdult}
              onChange={(e) => setIsAdult(e.target.checked)}
              className="mt-1"
            />
            <span>Confirmo que tenho 18 anos ou mais.</span>
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-6 text-sm underline text-muted-foreground"
      >
        {mode === "login" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}
