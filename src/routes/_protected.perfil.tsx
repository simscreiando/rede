import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarSignedUrl } from "@/server/avatar.functions";

export const Route = createFileRoute("/_protected/perfil")({
  component: PerfilPage,
});

type ProfileRow = {
  id: string;
  display_name: string;
  username: string | null;
  city: string | null;
  bio: string | null;
  visibility: "public" | "friends";
  avatar_path: string | null;
};

function PerfilPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, city, bio, visibility, avatar_path")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (data) {
        setProfile(data as ProfileRow);
        const { url } = await getAvatarSignedUrl({ data: { profileId: data.id } });
        setAvatarUrl(url);
      }
      setLoading(false);
    })();
  }, []);

  async function handleAvatarUpload(file: File) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Caminho SEMPRE prefixado pelo user_id — é o que a policy de Storage
    // exige (storage.foldername(name))[1] = auth.uid(), nunca um nome
    // escolhido livremente pela pessoa.
    const path = `${userData.user.id}/avatar-${Date.now()}.${file.name.split(".").pop()}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setMessage("Não foi possível enviar a imagem.");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", userData.user.id);

    if (!updateError) {
      setProfile((p) => (p ? { ...p, avatar_path: path } : p));
      const { url } = await getAvatarSignedUrl({ data: { profileId: userData.user.id } });
      setAvatarUrl(url);
    }
  }

  async function handleSave(formData: FormData) {
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: String(formData.get("display_name") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim() || null,
        bio: String(formData.get("bio") ?? "").trim() || null,
        visibility: formData.get("visibility") === "public" ? "public" : "friends",
      })
      .eq("id", profile.id);

    setSaving(false);
    setMessage(error ? "Não foi possível salvar agora." : "Perfil atualizado.");
  }

  if (loading) return <div className="px-6 py-16 text-center text-muted-foreground">Carregando…</div>;
  if (!profile) return <div className="px-6 py-16 text-center text-muted-foreground">Perfil não encontrado.</div>;

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold mb-8">Seu perfil</h1>

      <div className="mb-8 flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted" />
        )}
        <label className="text-sm underline cursor-pointer text-muted-foreground">
          Trocar foto
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAvatarUpload(file);
            }}
          />
        </label>
      </div>

      <form
        action={(fd) => void handleSave(fd)}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm mb-1" htmlFor="display_name">
            Nome de exibição
          </label>
          <input
            id="display_name"
            name="display_name"
            defaultValue={profile.display_name}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="city">
            Cidade
          </label>
          <input
            id="city"
            name="city"
            defaultValue={profile.city ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="bio">
            Sobre você
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={profile.bio ?? ""}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <div>
          <span className="block text-sm mb-1">Quem pode ver seu perfil</span>
          <label className="flex items-center gap-2 text-sm mb-1">
            <input type="radio" name="visibility" value="friends" defaultChecked={profile.visibility === "friends"} />
            Só amigos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="visibility" value="public" defaultChecked={profile.visibility === "public"} />
            Qualquer pessoa
          </label>
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </div>
  );
}
