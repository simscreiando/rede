import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/rede";

export const Route = createFileRoute("/comunidades/")({
  head: () => ({
    meta: [
      { title: "Comunidades — Rede" },
      {
        name: "description",
        content:
          "Comunidades temáticas na Rede: fóruns pequenos, moderados por quem participa, sem feed algorítmico.",
      },
      { property: "og:title", content: "Comunidades na Rede" },
      {
        property: "og:description",
        content: "Crie ou entre em comunidades temáticas com tópicos e regras claras.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <CommunitiesPage />
      </RequireAuth>
    </AppShell>
  ),
});

function CommunitiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const communities = useQuery({
    queryKey: ["communities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, slug, name, description, category")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const myMemberships = useQuery({
    queryKey: ["my-memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function createCommunity() {
    if (name.trim().length < 3) {
      toast.error("Dê um nome com pelo menos 3 letras.");
      return;
    }
    setCreating(true);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("communities")
      .insert({
        creator_id: user!.id,
        name: name.trim(),
        slug,
        description: description.trim() || null,
        category: category.trim() || null,
      })
      .select("id, slug")
      .single();

    if (error || !data) {
      setCreating(false);
      toast.error("Não foi possível criar a comunidade.");
      return;
    }

    await supabase
      .from("community_members")
      .insert({ community_id: data.id, user_id: user!.id, is_private: false });

    setCreating(false);
    setName("");
    setCategory("");
    setDescription("");
    void queryClient.invalidateQueries({ queryKey: ["communities"] });
    void navigate({ to: "/comunidades/$slug", params: { slug: data.slug } });
  }

  const memberOf = new Set((myMemberships.data ?? []).map((m) => m.community_id));

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <h1 className="text-2xl">Comunidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Espaços pequenos e temáticos, com tópicos em ordem cronológica. Você decide se sua
          participação aparece para as outras pessoas.
        </p>
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Criar uma comunidade</h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome-com">Nome</Label>
            <Input id="nome-com" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-com">Categoria (opcional)</Label>
            <Input
              id="cat-com"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="música, livros, cidade…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc-com">Sobre o que é</Label>
            <Textarea
              id="desc-com"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o tema e combine as regras de convivência desde já."
            />
          </div>
          <Button onClick={createCommunity} disabled={creating}>
            Criar comunidade
          </Button>
        </div>
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Comunidades existentes</h2>
        <ul className="mt-4 space-y-4">
          {(communities.data ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">
              Nenhuma comunidade ainda. Crie a primeira.
            </li>
          ) : null}
          {(communities.data ?? []).map((community) => (
            <li key={community.id} className="border-b border-border pb-4 last:border-none">
              <Link
                to="/comunidades/$slug"
                params={{ slug: community.slug }}
                className="text-base underline"
              >
                {community.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {community.category ?? "sem categoria"}
                {memberOf.has(community.id) ? " · você participa" : ""}
              </p>
              {community.description ? (
                <p className="mt-1 text-sm">{community.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
