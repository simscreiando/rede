import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/rede";

export const Route = createFileRoute("/configuracoes/dados")({
  head: () => ({
    meta: [
      { title: "Meus dados — Rede" },
      {
        name: "description",
        content:
          "Exporte uma cópia dos seus dados na Rede ou apague sua conta. Direitos da LGPD em autoatendimento.",
      },
      { property: "og:title", content: "Meus dados na Rede" },
      {
        property: "og:description",
        content: "Exportação em JSON e exclusão de conta, sem precisar pedir a ninguém.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <DataPage />
      </RequireAuth>
    </AppShell>
  ),
});

function DataPage() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function exportData() {
    if (!user) return;
    setBusy(true);
    try {
      const [profile, badges, testimonials, scraps, memberships, topics, posts, reports] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id),
          supabase.from("badges").select("*").or(`giver_id.eq.${user.id},receiver_id.eq.${user.id}`),
          supabase
            .from("testimonials")
            .select("*")
            .or(`author_id.eq.${user.id},profile_id.eq.${user.id}`),
          supabase.from("scraps").select("*").or(`author_id.eq.${user.id},profile_id.eq.${user.id}`),
          supabase.from("community_members").select("*").eq("user_id", user.id),
          supabase.from("community_topics").select("*").eq("author_id", user.id),
          supabase.from("community_posts").select("*").eq("author_id", user.id),
          supabase.from("reports").select("*").eq("reporter_id", user.id),
        ]);

      const payload = {
        exportado_em: new Date().toISOString(),
        aplicacao: APP_NAME,
        conta: { id: user.id, email: user.email },
        perfil: profile.data ?? [],
        selos: badges.data ?? [],
        depoimentos: testimonials.data ?? [],
        recados: scraps.data ?? [],
        comunidades: memberships.data ?? [],
        topicos: topics.data ?? [],
        mensagens: posts.data ?? [],
        denuncias_enviadas: reports.data ?? [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rede-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação gerada.");
    } catch {
      toast.error("Não foi possível gerar a exportação agora.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!user) return;
    const confirmed = window.confirm(
      "Isso apaga seu perfil, selos, depoimentos, recados e participações. A ação é definitiva. Deseja continuar?",
    );
    if (!confirmed) return;

    setBusy(true);
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível apagar os dados agora.");
      return;
    }
    toast.success("Seus dados de perfil foram apagados. Você será desconectada(o).");
    await signOut();
  }

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <h1 className="text-2xl">Meus dados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui você exerce direitos da LGPD sem depender de atendimento: acesso, portabilidade e
          eliminação.
        </p>
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Exportar uma cópia</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gera um arquivo JSON com o que a Rede guarda vinculado à sua conta.
        </p>
        <Button className="mt-4" onClick={exportData} disabled={busy}>
          Baixar meus dados
        </Button>
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Apagar minha conta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Apaga perfil e conteúdos ligados a ele. Registros de moderação podem ser mantidos de forma
          pseudonimizada quando houver obrigação legal de guarda.
        </p>
        <Button className="mt-4" variant="destructive" onClick={deleteAccount} disabled={busy}>
          Apagar definitivamente
        </Button>
      </section>
    </div>
  );
}
