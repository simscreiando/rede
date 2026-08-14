-- ============================================================================
-- 0006 — Storage: bucket de avatares
-- ============================================================================
-- Caminho dos objetos é sempre prefixado por "<user_id>/...", nunca um nome
-- arbitrário — isso é o que permite às policies abaixo verificar dono sem
-- precisar de uma tabela auxiliar. O frontend deve montar o path assim
-- (ex.: `${user.id}/avatar.webp`), nunca aceitar um path escolhido livremente
-- pelo usuário.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Leitura pública do bucket (avatares que aparecem em perfis públicos e nas
-- listagens de amigos). Perfis "somente amigos" continuam protegidos porque
-- a URL do avatar só é entregue ao cliente via a linha de `profiles`, que já
-- passa pela RLS de can_view_profile — o arquivo em si ficar com leitura
-- pública no Storage é o modelo padrão do Supabase e não expõe a listagem
-- de quem tem cada avatar sem o app entregar a URL primeiro.
CREATE POLICY "avatars_read_public" ON storage.objects
FOR SELECT TO authenticated, anon
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own_folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_update_own_folder" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own_folder" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
