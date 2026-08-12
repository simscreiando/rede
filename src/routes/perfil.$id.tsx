import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { ReportDialog } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BADGE_KINDS, formatDate, initials, isUuid } from "@/lib/rede";

export const Route = createFileRoute("/perfil/$id")({
  head: () => ({
    meta: [
      { title: "Perfil — Rede" },
      {
        name: "description",
        content:
          "Perfil na Rede: selos afetivos, depoimentos aprovados pelo titular e recados de amigos.",
      },
      { property: "og:title", content: "Perfil na Rede" },
      {
        property: "og:description",
        content: "Selos afetivos, depoimentos e recados — sem nota e sem ranking de pessoas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <ProfilePage />
      </RequireAuth>
    </AppShell>
  ),
});

function ProfilePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSelf = user?.id === id;
  const [testimonial, setTestimonial] = useState("");
  const [scrap, setScrap] = useState("");

  const profile = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const friendship = useQuery({
    queryKey: ["friendship", user?.id, id],
    enabled: !!user && !isSelf && isUuid(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .in("requester_id", [user!.id, id])
        .in("addressee_id", [user!.id, id])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const badges = useQuery({
    queryKey: ["badges", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("*").eq("receiver_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const testimonials = useQuery({
    queryKey: ["testimonials", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .eq("profile_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const scraps = useQuery({
    queryKey: ["scraps", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scraps")
        .select("*")
        .eq("profile_id", id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const areFriends = friendship.data?.status === "accepted";

  if (profile.isLoading) {
    return <p className="text-sm text-muted-foreground">Abrindo o perfil…</p>;
  }

  if (!profile.data) {
    return (
      <div className="paper-card p-6">
        <h1 className="text-xl">Perfil não disponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ou o perfil não existe, ou está configurado como visível apenas para amigos.
        </p>
      </div>
    );
  }

  const p = profile.data;

  async function sendFriendRequest() {
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user!.id, addressee_id: id });
    if (error) {
      toast.error("Não foi possível enviar o pedido.");
      return;
    }
    toast.success("Pedido de amizade enviado.");
    void queryClient.invalidateQueries({ queryKey: ["friendship"] });
  }

  async function giveBadge(kind: string) {
    const { error } = await supabase
      .from("badges")
      .insert({ giver_id: user!.id, receiver_id: id, kind });
    if (error) {
      toast.error("Você já ofereceu esse selo (ou ainda não são amigos).");
      return;
    }
    toast.success("Selo oferecido.");
    void queryClient.invalidateQueries({ queryKey: ["badges", id] });
  }

  async function sendTestimonial() {
    const { error } = await supabase
      .from("testimonials")
      .insert({ author_id: user!.id, profile_id: id, body: testimonial.trim() });
    if (error) {
      toast.error("Depoimentos podem ser escritos apenas entre amigos.");
      return;
    }
    setTestimonial("");
    toast.success("Depoimento enviado. Ele só aparece após a aprovação do titular do perfil.");
    void queryClient.invalidateQueries({ queryKey: ["testimonials", id] });
  }

  async function reviewTestimonial(testimonialId: string, status: "approved" | "removed") {
    const { error } = await supabase
      .from("testimonials")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", testimonialId);
    if (error) {
      toast.error("Não foi possível atualizar o depoimento.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["testimonials", id] });
  }

  async function sendScrap() {
    const { error } = await supabase
      .from("scraps")
      .insert({ author_id: user!.id, profile_id: id, body: scrap.trim() });
    if (error) {
      toast.error("Não foi possível deixar o recado.");
      return;
    }
    setScrap("");
    void queryClient.invalidateQueries({ queryKey: ["scraps", id] });
  }

  async function removeItem(table: "testimonials" | "scraps", itemId: string) {
    const { error } = await supabase.from(table).delete().eq("id", itemId);
    if (error) {
      toast.error("Não foi possível remover.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: [table, id] });
  }

  return (
    <div className="space-y-6">
      <section className="paper-card flex flex-wrap items-start gap-5 p-6">
        <Avatar className="size-20">
          <AvatarImage src={p.avatar_url ?? undefined} alt={`Foto de ${p.display_name}`} />
          <AvatarFallback>{initials(p.display_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-56 flex-1">
          <h1 className="text-2xl">{p.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {p.username ? `@${p.username}` : "sem apelido"}
            {p.city ? ` · ${p.city}` : ""} · na Rede desde {formatDate(p.created_at)}
          </p>
          {p.bio ? <p className="mt-3 whitespace-pre-line text-sm">{p.bio}</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Visibilidade: {p.visibility === "public" ? "perfil público" : "somente amigos"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isSelf ? (
            <Button asChild variant="secondary" size="sm">
              <Link to="/configuracoes/perfil">Editar perfil</Link>
            </Button>
          ) : (
            <>
              {areFriends ? (
                <Badge variant="secondary">Amigos</Badge>
              ) : friendship.data ? (
                <Badge variant="outline">Pedido pendente</Badge>
              ) : (
                <Button size="sm" onClick={sendFriendRequest}>
                  Pedir amizade
                </Button>
              )}
              <ReportDialog targetType="profile" targetId={id} label="Denunciar perfil" />
            </>
          )}
        </div>
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Selos afetivos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sem nota, sem média e sem ranking: apenas o que as pessoas reconhecem uma na outra.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {BADGE_KINDS.map((kind) => {
            const count = (badges.data ?? []).filter((b) => b.kind === kind.value).length;
            return (
              <span
                key={kind.value}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                {kind.emoji} {kind.label}
                {count > 0 ? ` · ${count}` : ""}
              </span>
            );
          })}
        </div>
        {!isSelf && areFriends ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {BADGE_KINDS.map((kind) => (
              <Button
                key={kind.value}
                size="sm"
                variant="secondary"
                onClick={() => giveBadge(kind.value)}
              >
                Oferecer {kind.label.toLowerCase()}
              </Button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Depoimentos</h2>
        {!isSelf && areFriends ? (
          <div className="mt-3 space-y-2">
            <Textarea
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              placeholder="Escreva um depoimento. Evite dados pessoais de outras pessoas."
            />
            <Button size="sm" onClick={sendTestimonial} disabled={testimonial.trim().length < 2}>
              Enviar depoimento
            </Button>
          </div>
        ) : null}

        <ul className="mt-5 space-y-4">
          {(testimonials.data ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">Nenhum depoimento por aqui ainda.</li>
          ) : null}
          {(testimonials.data ?? []).map((item) => (
            <li key={item.id} className="border-b border-border pb-4 last:border-none">
              <p className="text-sm font-semibold">
                {(item as { author?: { display_name?: string } }).author?.display_name ?? "Alguém"}
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  {formatDate(item.created_at)}
                  {item.status !== "approved" ? ` · ${statusLabel(item.status)}` : ""}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-line text-sm">{item.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {isSelf && item.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => reviewTestimonial(item.id, "approved")}>
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => reviewTestimonial(item.id, "removed")}
                    >
                      Recusar
                    </Button>
                  </>
                ) : null}
                {isSelf || item.author_id === user?.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem("testimonials", item.id)}
                  >
                    Remover
                  </Button>
                ) : null}
                <ReportDialog targetType="testimonial" targetId={item.id} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Recados</h2>
        {!isSelf ? (
          <div className="mt-3 space-y-2">
            <Textarea
              value={scrap}
              onChange={(e) => setScrap(e.target.value)}
              placeholder="Deixe um recado no mural."
            />
            <Button size="sm" onClick={sendScrap} disabled={scrap.trim().length < 1}>
              Deixar recado
            </Button>
          </div>
        ) : null}
        <ul className="mt-5 space-y-4">
          {(scraps.data ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">Mural vazio.</li>
          ) : null}
          {(scraps.data ?? []).map((item) => (
            <li key={item.id} className="border-b border-border pb-4 last:border-none">
              <p className="text-sm font-semibold">
                {(item as { author?: { display_name?: string } }).author?.display_name ?? "Alguém"}
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  {formatDate(item.created_at)}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-line text-sm">{item.body}</p>
              <div className="mt-2 flex gap-2">
                {isSelf || item.author_id === user?.id ? (
                  <Button size="sm" variant="ghost" onClick={() => removeItem("scraps", item.id)}>
                    Remover
                  </Button>
                ) : null}
                <ReportDialog targetType="scrap" targetId={item.id} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "pending") return "aguardando sua aprovação";
  if (status === "removed") return "removido";
  return status;
}
