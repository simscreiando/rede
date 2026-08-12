import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { ReportDialog } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/rede";
import { useProfileNames } from "@/lib/profileNames";

export const Route = createFileRoute("/comunidades/$slug")({
  head: () => ({
    meta: [
      { title: "Comunidade — Rede" },
      {
        name: "description",
        content:
          "Tópicos e conversas de uma comunidade da Rede, em ordem cronológica e com moderação humana.",
      },
      { property: "og:title", content: "Comunidade na Rede" },
      {
        property: "og:description",
        content: "Conversas temáticas em tópicos, sem feed algorítmico.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <CommunityPage />
      </RequireAuth>
    </AppShell>
  ),
});

function CommunityPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [privateMembership, setPrivateMembership] = useState(true);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const community = useQuery({
    queryKey: ["community", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const communityId = community.data?.id;

  const membership = useQuery({
    queryKey: ["membership", communityId, user?.id],
    enabled: !!communityId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_members")
        .select("*")
        .eq("community_id", communityId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const members = useQuery({
    queryKey: ["members", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_members")
        .select("id, user_id, is_private")
        .eq("community_id", communityId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const topics = useQuery({
    queryKey: ["topics", communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_topics")
        .select("*")
        .eq("community_id", communityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const posts = useQuery({
    queryKey: ["posts", openTopic],
    enabled: !!openTopic,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .eq("topic_id", openTopic!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { nameOf } = useProfileNames([
    ...(members.data ?? []).map((m) => m.user_id),
    ...(topics.data ?? []).map((t) => t.author_id),
    ...(posts.data ?? []).map((p) => p.author_id),
  ]);

  if (community.isLoading) {
    return <p className="text-sm text-muted-foreground">Abrindo a comunidade…</p>;
  }

  if (!community.data) {
    return (
      <div className="paper-card p-6">
        <h1 className="text-xl">Comunidade não encontrada</h1>
        <Button asChild variant="secondary" className="mt-4">
          <Link to="/comunidades">Ver comunidades</Link>
        </Button>
      </div>
    );
  }

  const isMember = !!membership.data;
  const isOwner = community.data.creator_id === user?.id;

  async function join() {
    const { error } = await supabase
      .from("community_members")
      .insert({ community_id: communityId!, user_id: user!.id, is_private: privateMembership });
    if (error) {
      toast.error("Não foi possível entrar agora.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["membership"] });
    void queryClient.invalidateQueries({ queryKey: ["members", communityId] });
  }

  async function leave() {
    const { error } = await supabase
      .from("community_members")
      .delete()
      .eq("id", membership.data!.id);
    if (error) {
      toast.error("Não foi possível sair agora.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["membership"] });
    void queryClient.invalidateQueries({ queryKey: ["members", communityId] });
  }

  async function toggleVisibility() {
    const { error } = await supabase
      .from("community_members")
      .update({ is_private: !membership.data!.is_private })
      .eq("id", membership.data!.id);
    if (error) {
      toast.error("Não foi possível atualizar a visibilidade.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["membership"] });
    void queryClient.invalidateQueries({ queryKey: ["members", communityId] });
  }

  async function createTopic() {
    const { error } = await supabase.from("community_topics").insert({
      community_id: communityId!,
      author_id: user!.id,
      title: title.trim(),
      body: body.trim() || null,
    });
    if (error) {
      toast.error("Só quem participa pode abrir tópicos.");
      return;
    }
    setTitle("");
    setBody("");
    void queryClient.invalidateQueries({ queryKey: ["topics", communityId] });
  }

  async function sendReply() {
    const { error } = await supabase
      .from("community_posts")
      .insert({ topic_id: openTopic!, author_id: user!.id, body: reply.trim() });
    if (error) {
      toast.error("Não foi possível responder.");
      return;
    }
    setReply("");
    void queryClient.invalidateQueries({ queryKey: ["posts", openTopic] });
  }

  async function removeTopic(topicId: string) {
    const { error } = await supabase.from("community_topics").delete().eq("id", topicId);
    if (error) {
      toast.error("Não foi possível remover o tópico.");
      return;
    }
    if (openTopic === topicId) setOpenTopic(null);
    void queryClient.invalidateQueries({ queryKey: ["topics", communityId] });
  }

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {community.data.category ?? "comunidade"}
        </p>
        <h1 className="text-2xl">{community.data.name}</h1>
        {community.data.description ? (
          <p className="mt-2 whitespace-pre-line text-sm">{community.data.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Criada em {formatDate(community.data.created_at)}
          {isOwner ? " · você criou esta comunidade" : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isMember ? (
            <>
              <Button size="sm" variant="secondary" onClick={leave}>
                Sair da comunidade
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={membership.data!.is_private}
                  onCheckedChange={toggleVisibility}
                />
                Manter minha participação privada
              </label>
            </>
          ) : (
            <>
              <Button size="sm" onClick={join}>
                Entrar na comunidade
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={privateMembership}
                  onCheckedChange={(checked) => setPrivateMembership(checked === true)}
                />
                Entrar sem aparecer na lista pública
              </label>
            </>
          )}
          <ReportDialog
            targetType="community"
            targetId={community.data.id}
            label="Denunciar comunidade"
          />
        </div>
      </section>

      {isMember ? (
        <section className="paper-card p-6">
          <h2 className="text-lg">Abrir um tópico</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="corpo">Primeira mensagem</Label>
              <Textarea id="corpo" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <Button size="sm" onClick={createTopic} disabled={title.trim().length < 3}>
              Publicar tópico
            </Button>
          </div>
        </section>
      ) : null}

      <section className="paper-card p-6">
        <h2 className="text-lg">Tópicos</h2>
        <ul className="mt-4 space-y-4">
          {(topics.data ?? []).length === 0 ? (
            <li className="text-sm text-muted-foreground">Nenhum tópico ainda.</li>
          ) : null}
          {(topics.data ?? []).map((topic) => (
            <li key={topic.id} className="border-b border-border pb-4 last:border-none">
              <button
                type="button"
                className="text-start text-base underline"
                onClick={() => setOpenTopic(openTopic === topic.id ? null : topic.id)}
              >
                {topic.title}
              </button>
              <p className="text-xs text-muted-foreground">
                por {nameOf(topic.author_id)} · {formatDate(topic.created_at)}
              </p>
              {topic.body ? (
                <p className="mt-1 whitespace-pre-line text-sm">{topic.body}</p>
              ) : null}
              <div className="mt-2 flex gap-2">
                {topic.author_id === user?.id ? (
                  <Button size="sm" variant="ghost" onClick={() => removeTopic(topic.id)}>
                    Remover tópico
                  </Button>
                ) : null}
                <ReportDialog targetType="community_topic" targetId={topic.id} />
              </div>

              {openTopic === topic.id ? (
                <div className="mt-4 space-y-3 border-s-2 border-border ps-4">
                  {(posts.data ?? []).map((post) => (
                    <div key={post.id}>
                      <p className="text-xs text-muted-foreground">
                        {nameOf(post.author_id)} · {formatDate(post.created_at)}
                      </p>
                      <p className="whitespace-pre-line text-sm">{post.body}</p>
                      <ReportDialog targetType="community_post" targetId={post.id} />
                    </div>
                  ))}
                  {isMember ? (
                    <div className="space-y-2">
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Responder ao tópico"
                      />
                      <Button size="sm" onClick={sendReply} disabled={reply.trim().length < 1}>
                        Responder
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="paper-card p-6">
        <h2 className="text-lg">Quem participa</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Aparecem aqui apenas as pessoas que escolheram tornar a participação visível.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {(members.data ?? []).map((member) => (
            <li key={member.id}>
              <Link to="/perfil/$id" params={{ id: member.user_id }} className="underline">
                {nameOf(member.user_id)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
