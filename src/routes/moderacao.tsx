import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, reasonLabel } from "@/lib/rede";

export const Route = createFileRoute("/moderacao")({
  head: () => ({
    meta: [
      { title: "Painel de moderação — Rede" },
      {
        name: "description",
        content:
          "Fila de denúncias da Rede com decisão justificada e registro de auditoria. Acesso restrito à moderação.",
      },
      { property: "og:title", content: "Painel de moderação da Rede" },
      {
        property: "og:description",
        content: "Triagem, decisão justificada e histórico auditável.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <ModerationPage />
      </RequireAuth>
    </AppShell>
  ),
});

const DECISIONS = [
  { value: "dismissed", label: "Arquivar sem medida" },
  { value: "content_removed", label: "Remover conteúdo" },
  { value: "warning", label: "Enviar aviso" },
  { value: "suspension", label: "Suspender conta" },
];

function ModerationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { action: string; note: string }>>({});

  const isModerator = useQuery({
    queryKey: ["is-moderator", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).some((r) => r.role === "moderator" || r.role === "admin");
    },
  });

  const reports = useQuery({
    queryKey: ["reports"],
    enabled: isModerator.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isModerator.isLoading) {
    return <p className="text-sm text-muted-foreground">Verificando permissões…</p>;
  }

  if (!isModerator.data) {
    return (
      <div className="paper-card p-6">
        <h1 className="text-xl">Área restrita</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Somente contas com papel de moderação ou administração acessam a fila de denúncias.
        </p>
      </div>
    );
  }

  async function decide(reportId: string, status: "upheld" | "dismissed") {
    const draft = drafts[reportId];
    if (!draft?.action || draft.note.trim().length < 10) {
      toast.error("Escolha uma medida e escreva uma justificativa com pelo menos 10 caracteres.");
      return;
    }

    const { error: actionError } = await supabase.from("moderation_actions").insert({
      report_id: reportId,
      moderator_id: user!.id,
      action: draft.action,
      justification: draft.note.trim(),
    });
    if (actionError) {
      toast.error("Não foi possível registrar a decisão.");
      return;
    }

    const { error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", reportId);
    if (error) {
      toast.error("Decisão registrada, mas o status não foi atualizado.");
      return;
    }

    toast.success("Decisão registrada com justificativa.");
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  const rows = reports.data ?? [];

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <h1 className="text-2xl">Painel de moderação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toda decisão exige uma medida e uma justificativa escrita, que ficam registradas para
          auditoria e para eventual recurso.
        </p>
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Denúncias</h2>
        <ul className="mt-4 space-y-6">
          {rows.length === 0 ? (
            <li className="text-sm text-muted-foreground">Nenhuma denúncia na fila.</li>
          ) : null}
          {rows.map((report) => {
            const draft = drafts[report.id] ?? { action: "", note: "" };
            return (
              <li key={report.id} className="border-b border-border pb-6 last:border-none">
                <p className="text-sm font-semibold">
                  {reasonLabel(report.reason)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {report.target_type} · {formatDate(report.created_at)} · {report.status}
                  </span>
                </p>
                {report.details ? (
                  <p className="mt-1 whitespace-pre-line text-sm">{report.details}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">alvo: {report.target_id}</p>

                {report.status === "open" || report.status === "reviewing" ? (
                  <div className="mt-3 space-y-3">
                    <Select
                      value={draft.action}
                      onValueChange={(value) =>
                        setDrafts({ ...drafts, [report.id]: { ...draft, action: value } })
                      }
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Escolha a medida" />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISIONS.map((decision) => (
                          <SelectItem key={decision.value} value={decision.value}>
                            {decision.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={draft.note}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [report.id]: { ...draft, note: e.target.value } })
                      }
                      placeholder="Justificativa da decisão (obrigatória)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => decide(report.id, "upheld")}>
                        Aplicar medida
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => decide(report.id, "dismissed")}
                      >
                        Arquivar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
