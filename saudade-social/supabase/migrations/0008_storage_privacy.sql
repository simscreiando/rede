-- ============================================================================
-- 0008 — CORREÇÃO DE PRIVACIDADE: bucket de avatares deixa de ser público
-- ============================================================================
-- Achado: bucket "avatars" criado com public=true na migration 0006.
-- Um bucket público no Supabase Storage serve qualquer objeto por URL
-- direta sem checar RLS de leitura — incompatível com perfil visibility
-- = 'friends', porque o avatar de um perfil "só amigos" ficaria acessível
-- para qualquer pessoa com a URL, mesmo sem ser amigo.
--
-- Correção: bucket privado. Entrega de avatar passa a ser via signed URL
-- de curta duração, gerada por uma server function (Node, Fase 2) SOMENTE
-- depois de confirmar app_private.can_view_profile(auth.uid(), dono) —
-- exatamente a mesma regra que já protege a leitura da linha em `profiles`.
-- Geração de signed URL usa o client de service-role (só em código
-- server-side, nunca no navegador) e por isso naturalmente ignora a RLS de
-- storage.objects — a permissão real é garantida pela checagem explícita
-- de can_view_profile ANTES de gerar a URL, não pela RLS do bucket.
--
-- A RLS de storage.objects abaixo continua existindo como camada extra:
-- protege contra alguém usando o PRÓPRIO token para tentar baixar/listar
-- direto pela API de Storage (contornando nossa server function), caso em
-- que só o dono do arquivo tem acesso.

UPDATE storage.buckets SET public = false WHERE id = 'avatars';

DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;

CREATE POLICY "avatars_read_owner_only" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Renomeia a coluna para deixar explícito que agora é um PATH interno do
-- bucket privado (ex.: "<user_id>/avatar.webp"), não mais uma URL pública
-- utilizável diretamente em um <img src>.
ALTER TABLE public.profiles RENAME COLUMN avatar_url TO avatar_path;

-- RPC pública para a checagem de visibilidade de perfil, reaproveitando
-- app_private.can_view_profile — usada pela server function de signed URL
-- (que roda como usuário autenticado comum, não como service-role, na hora
-- de checar permissão) e por qualquer outra tela que precise da mesma
-- pergunta ("eu, usuário atual, posso ver o perfil X?").
CREATE OR REPLACE FUNCTION public.check_can_view_profile(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.can_view_profile(auth.uid(), _profile_id)
$$;
REVOKE ALL ON FUNCTION public.check_can_view_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_can_view_profile(uuid) TO authenticated;
