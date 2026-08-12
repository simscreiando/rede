import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/configuracoes/perfil")({
  head: () => ({
    meta: [
      { title: "Editar perfil — Rede" },
      {
        name: "description",
        content:
          "Ajuste nome, apelido, bio e a visibilidade do seu perfil na Rede: público ou somente amigos.",
      },
      { property: "og:title", content: "Editar perfil na Rede" },
      {
        property: "og:description",
        content: "Você controla o que aparece e para quem aparece.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireAuth>
        <ProfileSettings />
      </RequireAuth>
    </AppShell>
  ),
});

function ProfileSettings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [saving, setSaving] = useState(false);

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.display_name ?? "");
    setUsername(profile.data.username ?? "");
    setCity(profile.data.city ?? "");
    setBio(profile.data.bio ?? "");
    setVisibility(profile.data.visibility ?? "public");
  }, [profile.data]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        username: username.trim() ? username.trim().toLowerCase() : null,
        city: city.trim() || null,
        bio: bio.trim() || null,
        visibility,
      })
      .eq("id", user!.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar. O apelido pode já estar em uso.");
      return;
    }
    toast.success("Perfil atualizado.");
  }

  return (
    <div className="space-y-6">
      <section className="paper-card p-6">
        <h1 className="text-2xl">Editar perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha só o que quiser. Menos dados é sempre uma opção legítima.
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display">Nome de exibição</Label>
            <Input
              id="display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Apelido (@)</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="apenas letras, números, ponto e underline"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade (opcional)</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={5} />
          </div>
          <div className="space-y-1.5">
            <Label>Quem pode ver seu perfil</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Qualquer pessoa com conta na Rede</SelectItem>
                <SelectItem value="friends">Somente minhas amizades</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              Salvar
            </Button>
            {user ? (
              <Button asChild variant="secondary">
                <Link to="/perfil/$id" params={{ id: user.id }}>
                  Ver meu perfil
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link to="/configuracoes/dados">Meus dados</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
