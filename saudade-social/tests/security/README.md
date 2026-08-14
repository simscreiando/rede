# Testes de segurança — matriz obrigatória

A maioria destes testes precisa de um projeto Supabase real (local via
Supabase CLI + Docker, ou um projeto de staging) para executar de verdade —
são testes de integração contra RLS/triggers do Postgres, não testes
unitários puros. Este sandbox não tem acesso de rede para rodar
`supabase start` nem para se conectar a um projeto remoto, então a
implementação destes testes (arquivos `.test.ts` com um client Supabase
apontando para um banco efêmero de teste) é entregue como parte da
**Fase 2** (auth/closed beta) e da **Fase 8** (QA), quando cada
funcionalidade que eles cobrem já existir de fato. Rodar testes contra
código que ainda não existe não teria valor.

Cada linha abaixo referencia a fase em que a funcionalidade correspondente é
construída e o teste correspondente passa a existir e rodar no CI.

| # | Cenário | Fase |
|---|---|---|
| 1 | Usuário autorizado + Google → acesso permitido | Fase 2 |
| 2 | Usuário não autorizado + Google → acesso negado | Fase 2 |
| 3 | Usuário autorizado + e-mail → acesso permitido | Fase 2 |
| 4 | Usuário não autorizado + e-mail → cadastro/login bloqueado | Fase 2 |
| 5 | Usuário não autenticado tentando acessar rota privada → bloqueado | Fase 2 |
| 6 | Usuário autenticado mas beta revogado → bloqueado | Fase 2 |
| 7 | Usuário A tentando acessar dados privados de B → bloqueado | Fase 3 (perfis/amizades) |
| 8 | Usuário não membro tentando publicar em comunidade privada → bloqueado | Fase 5 |
| 9 | Usuário tentando alterar author_id/body de depoimento → bloqueado | Fase 4 |
| 10 | Usuário comum tentando executar ação de moderador → bloqueado | Fase 6 |
| 11 | Exclusão de conta remove/trata corretamente Auth + dados dependentes | Fase 7 |
| 12 | Service-role key nunca aparece no bundle do cliente | **Já automatizado** — `bun run verify:bundle`, roda no CI a cada build (ver `scripts/check-no-secrets-in-bundle.mjs`) |

As RLS policies e os triggers que tornam os testes 1–10 possíveis de passar
já foram escritos nas migrations da Fase 0 (`supabase/migrations/000*.sql`).
O que falta para os testes 1–10 é a integração/rotas da Fase 2 em diante —
as migrations, sozinhas, já impedem os cenários de bypass no nível do banco,
mas "impedir no banco" e "ter um teste automatizado provando isso" são coisas
diferentes, e a spec pede as duas.
