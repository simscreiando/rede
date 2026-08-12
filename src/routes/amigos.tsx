import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useProfileNames } from "@/lib/profileNames";

export const Route = createFileRoute("/amigos")({
  head: () => ({
    meta: [
      { title: "Amizades — Rede" },
      {
        name: "description",
        content:
          "Encontre pessoas, envie pedidos de amizade e gerencie sua lista de amizades na Rede.",
      },
      { property: "og:title", content: "Amizades na Rede" },
      {
        property: "og:description",
        content: "Pedidos, buscas e lista de amizades — conexões por consentimento mútuo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <FriendsPage />
      </RequireAuth>
    </AppShell>
  ),
});

type Row = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
};

function FriendsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<
    { id: string; display_name: string; username: string | null }[]
  >([]);

  const relations = useQuery({
    queryKey: ["friendships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = relations.data ?? [];
  const { nameOf } = useProfileNames(rows.flatMap((r) => [r.requester_id, r.addressee_id]));

  async function search() {
    const raw = term.trim();
    if (raw.length < 2) return;
    // Remove PostgREST filter syntax characters so user text can never alter the query structure.
    const safe = raw.replace(/[,.()"\\%*]/g, " ").trim().slice(0, 60);
    if (safe.length < 2) {
      toast.error("Use letras e números na busca.");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .or(`display_name.ilike."%${safe}%",username.ilike."%${safe}%"`)
      .neq("id", user!.id)
      .limit(12);
    if (error) {
      toast.error("Busca indisponível agora.");
      return;
    }
    setResults(data ?? []);
  }

  async function request(targetId: string) {
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user!.id, addressee_id: targetId });
    if (error) {
      toast.error("Já existe um pedido entre vocês.");
      return;
    }
    toast.success("Pedido enviado.");
    void queryClient.invalidateQueries({ queryKey: ["friendships"] });
  }

  async function respond(friendshipId: string, status: "accepted" | "declined") {
    const { error } = await supabase
      .from("friendships")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", friendshipId);
    if (error) {
      toast.error("Não foi possível responder ao pedido.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["friendships"] });
  }

  async function remove(friendshipId: string) {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) {
      toast.error("Não foi possível desfazer.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["friendships"] });
  }

  const pendingForMe = rows.filter((r) => r.status === "pending" && r.addressee_id === user?.id);
  const pendingFromMe = rows.filter((r) => r.status === "pending" && r.requester_id === user?.id);
  const accepted = rows.filter((r) => r.status === "accepted");

  const otherId = (row: Row) => (row.requester_id === user?.id ? row.addressee_id : row.requester_id);

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <h1 className="text-2xl">Amizades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toda conexão depende do aceite das duas pessoas. Nada de sugestões automáticas.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nome ou apelido"
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
          />
          <Button onClick={search} variant="secondary">
            Buscar
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {results.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-3 text-sm">
              <Link to="/perfil/$id" params={{ id: person.id }} className="underline">
                {person.display_name}
                {person.username ? ` (@${person.username})` : ""}
              </Link>
              <Button size="sm" onClick={() => request(person.id)}>
                Pedir amizade
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <FriendGroup
        title="Pedidos recebidos"
        empty="Nenhum pedido aguardando você."
        rows={pendingForMe}
        otherId={otherId}
        nameOf={nameOf}
        renderActions={(row) => (
          <>
            <Button size="sm" onClick={() => respond(row.id, "accepted")}>
              Aceitar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => respond(row.id, "declined")}>
              Recusar
            </Button>
          </>
        )}
      />

      <FriendGroup
        title="Pedidos enviados"
        empty="Você não tem pedidos pendentes."
        rows={pendingFromMe}
        otherId={otherId}
        nameOf={nameOf}
        renderActions={(row) => (
          <Button size="sm" variant="ghost" onClick={() => remove(row.id)}>
            Cancelar
          </Button>
        )}
      />

      <FriendGroup
        title="Minhas amizades"
        empty="Sua lista de amizades está vazia."
        rows={accepted}
        otherId={otherId}
        nameOf={nameOf}
        renderActions={(row) => (
          <Button size="sm" variant="ghost" onClick={() => remove(row.id)}>
            Desfazer amizade
          </Button>
        )}
      />
    </div>
  );
}

function FriendGroup({
  title,
  empty,
  rows,
  renderActions,
  otherId,
  nameOf,
}: {
  title: string;
  empty: string;
  rows: Row[];
  renderActions: (row: Row) => React.ReactNode;
  otherId: (row: Row) => string;
  nameOf: (id: string | null | undefined) => string;
}) {
  return (
    <section className="paper-card p-6">
      <h2 className="text-lg">{title}</h2>
      <ul className="mt-3 space-y-2">
        {rows.length === 0 ? <li className="text-sm text-muted-foreground">{empty}</li> : null}
        {rows.map((row) => {
          const id = otherId(row);
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <Link to="/perfil/$id" params={{ id }} className="underline">
                {nameOf(id)}
              </Link>
              <span className="flex gap-2">{renderActions(row)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
