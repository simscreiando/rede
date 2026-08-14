# Bootstrap do primeiro administrador

## Por que isso precisa ser manual

`user_roles` nunca concede `INSERT`/`UPDATE`/`DELETE` para o role `authenticated`
(só `SELECT` — ver migration `0001_foundation_roles_and_beta.sql`). A única forma
de conceder um papel pela aplicação é a função `public.set_user_role`, criada na
migration `0007_security_audit_fixes.sql` — e ela **exige** que quem a chama já
seja admin (`app_private.is_admin(auth.uid())`).

Isso é intencional: impede que um usuário comum se autopromova. Mas também
significa que o **primeiro** admin não pode ser criado pela aplicação — não
existe ninguém admin ainda para autorizar a criação do primeiro.

## Procedimento (fazer uma única vez, por projeto)

1. Crie sua própria conta normalmente pelo fluxo de cadastro da Saudade Social
   (respeitando o closed beta — seu e-mail precisa estar em `beta_access`
   primeiro; ver `README.md`).
2. Descubra seu `user_id` (é o `id` em `auth.users`, o mesmo valor de `auth.uid()`
   quando você está logado):

   ```sql
   select id, email from auth.users where email = 'voce@exemplo.com';
   ```

3. No **SQL Editor do Dashboard do Supabase** (não pela aplicação — o SQL Editor
   roda como um role com privilégio total, contornando a RLS de propósito só
   para esta operação única), insira o papel de admin diretamente:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('<seu-user-id>', 'admin');
   ```

4. A partir daqui, use a aplicação normalmente — como admin, você já pode:
   - gerenciar `beta_access` (autorizar/revogar e-mails);
   - ligar/desligar o modo beta (`select public.set_beta_mode_enabled(false);`);
   - promover/revogar outros admins ou moderadores via `public.set_user_role(...)`.

## Por que não um script automático

Um script de bootstrap automático (ex.: "primeiro usuário cadastrado vira admin")
é uma superfície de risco desnecessária: se alguém descobrir a URL antes do
`beta_access` estar populado corretamente, essa pessoa se tornaria admin. O
procedimento manual acima depende de acesso ao Dashboard do Supabase (que só o
dono do projeto tem), então não há esse risco.
