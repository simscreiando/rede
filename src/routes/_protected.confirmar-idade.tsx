import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Único lugar do sistema onde is_adult_confirmed é definido como true. Não
// existe um caminho alternativo por Google — a pessoa passa por aqui
// exatamente do mesmo jeito, tenha entrado por e-mail ou por Google, porque
// o beforeLoad de _protected redireciona para cá sempre que
// is_adult_confirmed = false, antes de qualquer outra rota protegida.
export const Route = createFileRoute("/_protected/confirmar-idade")({
  component: ConfirmarIdadePage,
});

function ConfirmarIdadePage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Sessão expirada. Entre novamente.");
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_adult_confirmed: true })
      .eq("id", userData.user.id);

    setSubmitting(false);

    if (updateError) {
      setError("Não foi possível confirmar agora. Tente de novo em instantes.");
      return;
    }

    void navigate({ to: "/perfil" });
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold mb-4">Só mais uma coisa</h1>
      <p className="text-muted-foreground mb-6">
        Nesta fase, a Saudade Social é uma plataforma para maiores de 18 anos.
      </p>
      <label className="flex items-start gap-3 mb-6 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1"
        />
        <span>Confirmo que tenho 18 anos ou mais.</span>
      </label>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <button
        type="button"
        disabled={!checked || submitting}
        onClick={() => void handleConfirm()}
        className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
      >
        {submitting ? "Confirmando…" : "Confirmar e continuar"}
      </button>
    </div>
  );
}
