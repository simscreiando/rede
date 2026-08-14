-- ============================================================================
-- Testes de segurança em SQL puro — RLS e SECURITY DEFINER functions.
--
-- COMO RODAR (ambiente real, não este sandbox — ver aviso no relatório da
-- auditoria):
--   supabase start
--   supabase db reset            -- aplica todas as migrations do zero
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" \
--        -f tests/security/rls_and_functions.test.sql
--
-- Cada bloco usa `set local role authenticated;` + `set local
-- request.jwt.claim.sub = '<uuid>';` para simular uma requisição
-- autenticada como um usuário específico, do jeito que o PostgREST faz de
-- verdade — é a forma padrão de testar RLS por fora da aplicação.
-- Cada teste levanta uma EXCEPTION (aborta o script) se a asserção falhar,
-- então "rodou até o fim sem erro" = todos os testes passaram.
-- ============================================================================

begin;

-- ---------- fixtures: três usuários de teste em auth.users ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@teste.saudade.social'),
  ('00000000-0000-0000-0000-00000000000b', 'alice@teste.saudade.social'),
  ('00000000-0000-0000-0000-00000000000c', 'bob@teste.saudade.social')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin')
on conflict do nothing;

insert into public.profiles (id, display_name, visibility, is_adult_confirmed) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin de Teste', 'public', true),
  ('00000000-0000-0000-0000-00000000000b', 'Alice', 'friends', true),
  ('00000000-0000-0000-0000-00000000000c', 'Bob', 'friends', true)
on conflict (id) do update set is_adult_confirmed = excluded.is_adult_confirmed;

-- ============================================================================
-- TESTE: audit_log — usuário comum NÃO consegue inserir diretamente
-- ============================================================================
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
begin
  begin
    insert into public.audit_log (actor_id, action) values (auth.uid(), 'evento_forjado');
    raise exception 'FALHOU: audit_log permitiu INSERT direto de um usuário comum';
  exception
    when insufficient_privilege then
      raise notice 'PASSOU: audit_log bloqueou INSERT direto (insufficient_privilege)';
  end;
end $$;

reset role;

-- ============================================================================
-- TESTE: user_roles — usuário comum NÃO consegue se autopromover a admin
-- ============================================================================
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
begin
  begin
    insert into public.user_roles (user_id, role)
    values ('00000000-0000-0000-0000-00000000000b', 'admin');
    raise exception 'FALHOU: usuário comum conseguiu inserir o próprio papel de admin';
  exception
    when insufficient_privilege then
      raise notice 'PASSOU: user_roles bloqueou auto-promoção (insufficient_privilege)';
  end;

  begin
    perform public.set_user_role('00000000-0000-0000-0000-00000000000b', 'admin', true);
    raise exception 'FALHOU: set_user_role permitiu que um não-admin promovesse alguém';
  exception
    when others then
      raise notice 'PASSOU: set_user_role rejeitou chamada de um não-admin (%: %)', sqlstate, sqlerrm;
  end;
end $$;

reset role;

-- admin de teste consegue promover Bob a moderator via a RPC oficial
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$
begin
  perform public.set_user_role('00000000-0000-0000-0000-00000000000c', 'moderator', true);
  if not exists (
    select 1 from public.user_roles
    where user_id = '00000000-0000-0000-0000-00000000000c' and role = 'moderator'
  ) then
    raise exception 'FALHOU: set_user_role não gravou o papel de moderator para Bob';
  end if;
  raise notice 'PASSOU: admin promoveu Bob a moderator via set_user_role';
end $$;

reset role;

-- ============================================================================
-- TESTE: beta_access — check_email_beta_access não é mais chamável pelo cliente
-- ============================================================================
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
begin
  begin
    perform public.check_email_beta_access('alguem@exemplo.com');
    raise exception 'FALHOU: check_email_beta_access ainda é executável por authenticated';
  exception
    when insufficient_privilege then
      raise notice 'PASSOU: check_email_beta_access bloqueada para authenticated (insufficient_privilege)';
  end;
end $$;

reset role;

-- ============================================================================
-- TESTE: friendships — pedido cruzado vira aceite automático (decisão 14.1)
-- ============================================================================
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
begin
  insert into public.friendships (requester_id, addressee_id)
  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');
end $$;

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';

do $$
begin
  insert into public.friendships (requester_id, addressee_id)
  values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b');

  if not exists (
    select 1 from public.friendships
    where requester_id = '00000000-0000-0000-0000-00000000000b'
      and addressee_id = '00000000-0000-0000-0000-00000000000c'
      and status = 'accepted'
  ) then
    raise exception 'FALHOU: pedido cruzado não convergiu para accepted';
  end if;

  if exists (
    select 1 from public.friendships
    where requester_id = '00000000-0000-0000-0000-00000000000c'
      and addressee_id = '00000000-0000-0000-0000-00000000000b'
  ) then
    raise exception 'FALHOU: o segundo pedido criou uma linha extra em vez de ser cancelado';
  end if;

  raise notice 'PASSOU: pedido cruzado convergiu para uma única linha accepted';
end $$;

reset role;

-- ============================================================================
-- TESTE: testimonials — autor NÃO consegue fazer UPDATE livre (body/author_id)
-- ============================================================================
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
declare
  _id uuid;
begin
  insert into public.testimonials (author_id, profile_id, body)
  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 'Depoimento original')
  returning id into _id;

  begin
    update public.testimonials set body = 'Texto adulterado pelo autor' where id = _id;
    raise exception 'FALHOU: UPDATE direto em testimonials foi permitido (não deveria existir GRANT UPDATE)';
  exception
    when insufficient_privilege then
      raise notice 'PASSOU: testimonials bloqueou UPDATE direto (insufficient_privilege)';
  end;
end $$;

reset role;

-- Bob (dono do perfil) aprova via a RPC correta, sem poder alterar o texto
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';

do $$
declare
  _t record;
begin
  select * into _t from public.testimonials
  where author_id = '00000000-0000-0000-0000-00000000000b'
    and profile_id = '00000000-0000-0000-0000-00000000000c'
  limit 1;

  perform public.set_testimonial_status(_t.id, 'approved');

  if (select status from public.testimonials where id = _t.id) <> 'approved' then
    raise exception 'FALHOU: set_testimonial_status não aprovou o depoimento';
  end if;
  if (select body from public.testimonials where id = _t.id) <> 'Depoimento original' then
    raise exception 'FALHOU: o texto do depoimento mudou através de set_testimonial_status';
  end if;
  raise notice 'PASSOU: set_testimonial_status aprovou sem alterar o texto original';
end $$;

reset role;

-- ============================================================================
-- TESTE: communities — criador vira membro automaticamente
-- ============================================================================
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
declare
  _community_id uuid;
begin
  insert into public.communities (slug, name, creator_id, is_open)
  values ('comunidade-teste', 'Comunidade Teste', '00000000-0000-0000-0000-00000000000b', true)
  returning id into _community_id;

  if not exists (
    select 1 from public.community_members
    where community_id = _community_id and user_id = '00000000-0000-0000-0000-00000000000b'
  ) then
    raise exception 'FALHOU: criador da comunidade não virou membro automaticamente';
  end if;
  raise notice 'PASSOU: criador da comunidade virou membro automaticamente';

  -- guarda o id para o próximo teste via uma variável de sessão simples
  perform set_config('test.community_id', _community_id::text, false);
end $$;

reset role;

-- ============================================================================
-- TESTE: community_posts — não-membro NÃO consegue responder em tópico
-- ============================================================================
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
declare
  _community_id uuid := current_setting('test.community_id')::uuid;
  _topic_id uuid;
begin
  insert into public.community_topics (community_id, author_id, title)
  values (_community_id, '00000000-0000-0000-0000-00000000000b', 'Tópico de teste')
  returning id into _topic_id;

  perform set_config('test.topic_id', _topic_id::text, false);
end $$;

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c'; -- Bob, não é membro

do $$
declare
  _topic_id uuid := current_setting('test.topic_id')::uuid;
begin
  begin
    insert into public.community_posts (topic_id, author_id, body)
    values (_topic_id, '00000000-0000-0000-0000-00000000000c', 'Resposta de quem não é membro');
    raise exception 'FALHOU: non-membro conseguiu responder no tópico (bug original da auditoria voltou)';
  exception
    when insufficient_privilege then
      raise notice 'PASSOU: community_posts bloqueou resposta de não-membro (insufficient_privilege)';
  end;
end $$;

reset role;

-- ============================================================================
-- TESTE: storage.objects — bucket de avatares não é mais público
-- ============================================================================
do $$
begin
  if (select public from storage.buckets where id = 'avatars') is distinct from false then
    raise exception 'FALHOU: bucket avatars ainda está marcado como público';
  end if;
  raise notice 'PASSOU: bucket avatars está privado';
end $$;

-- desfaz tudo — este arquivo nunca deve deixar dados de teste no banco.
rollback;
