# Rede — rede social nostálgica (MVP 1)

Uma rede social afetiva inspirada na cultura da web dos anos 2000, com estética cozy/lo-fi, contas reais com login Google, e arquitetura pensada para privacidade desde o início.

## Decisões já fixadas

- Nome provisório: **Rede**
- Contas reais, com **entrar com Google** (e e-mail/senha como alternativa)
- **Selos afetivos** (amizade, admiração, confiança, parceria) — sem nota média, sem ranking público
- Estética **cozy / lo-fi**: papel envelhecido, tons quentes e suaves, tipografia arredondada, cantos macios, textura leve, nada de brilho corporativo
- Público **18+** nesta fase (declaração de idade no cadastro), para não entrar no regime do ECA Digital antes de ter estrutura de aferição de idade

## O que será construído nesta etapa

Páginas:

1. **Início (/)** — apresentação da Rede, princípios (sem algoritmo, sem ranking, sem publicidade comportamental), entrar/criar conta
2. **Entrar (/auth)** — Google + e-mail/senha
3. **Meu perfil e perfil de outros (/perfil/$id)** — foto, nome, cidade, "quem sou eu", selos recebidos, mural de depoimentos
4. **Editar perfil (/configuracoes/perfil)** — inclui escolher o que é público
5. **Amigos (/amigos)** — pedidos enviados/recebidos, aceitar/recusar, lista
6. **Comunidades (/comunidades, /comunidades/$id)** — criar, entrar, sair, tópicos e respostas
7. **Depoimentos** — escrever no perfil de um amigo; o dono do perfil aprova antes de aparecer
8. **Recados (mural público do perfil)**
9. **Denunciar** — botão em perfil, depoimento, comunidade e tópico
10. **Meus dados (/configuracoes/dados)** — ver tudo que a plataforma guarda, exportar, apagar conteúdo, apagar conta
11. **Moderação (/admin)** — fila de denúncias, decisão com justificativa, histórico; visível só para quem tem papel de moderador
12. **Páginas públicas de texto** — /privacidade, /termos, /diretrizes (conteúdo autoral, revisável por você)

Fora do escopo agora: mensagens privadas, fotos em álbuns, busca avançada, notificações por e-mail, aplicativo, monetização.

## Governança embutida no produto (o diferencial)

- Depoimento só aparece após aprovação do titular do perfil; o autor pode apagar o que escreveu; o titular pode remover do seu perfil. O conteúdo removido sai da visualização e é retido por prazo curto apenas para trilha de moderação.
- Perfis têm visibilidade: público / só amigos. Perfil "só amigos" não aparece em listagens abertas.
- Participação em comunidades pode ser marcada como privada, justamente porque revela inferências sensíveis.
- Registro de auditoria para ações administrativas (quem viu, quem removeu, por quê).
- Nenhum papel administrativo por padrão; moderador é concedido por registro em tabela separada de papéis.

## Detalhes técnicos

- Backend: Lovable Cloud (banco Postgres, autenticação, storage), com RLS em todas as tabelas e grants explícitos.
- Login Google gerenciado pelo Cloud; senha nunca trafega pela aplicação nem é armazenada por nós.
- Tabelas separadas por finalidade, não uma tabela gigante: `profiles`, `profile_visibility`, `friendships`, `badges`, `testimonials`, `scraps`, `communities`, `community_members`, `community_topics`, `community_posts`, `reports`, `moderation_actions`, `audit_log`, `user_roles`.
- Papéis via `user_roles` + função `has_role` (security definer) — nunca papel guardado no perfil.
- Fotos de perfil em storage, não no banco.
- Frontend: TanStack Start já configurado no projeto; rotas próprias por seção (SEO e compartilhamento), design tokens cozy/lo-fi definidos em `src/styles.css`.
- Ordem de implementação: design system e páginas públicas → autenticação e perfil → amizades e selos → depoimentos e recados → comunidades → denúncias e moderação → painel "Meus dados".

## Hospedagem: Lovable + GitHub + Vercel

A cadeia funciona assim, e cada elo tem um responsável diferente:

```text
Lovable (edição do código)
   ↓ sincronização Git
GitHub (repositório oficial, versionamento)
   ↓ deploy automático a cada commit
Vercel (site no ar, front + servidor)
   ↓ chamadas autenticadas
Lovable Cloud (banco de dados, login Google, arquivos)
```

Passos, na ordem:

1. **Lovable → GitHub**: você conecta sua conta GitHub no menu "+" do chat (opção GitHub) e o Lovable cria/sincroniza o repositório. Sincronização de mão dupla: o que eu escrever aqui aparece lá, e o que for commitado lá volta para cá. Esse passo é feito por você na interface — eu não consigo autorizar sua conta GitHub.
2. **Ajuste de build para a Vercel** (isso é o que eu faço no código): este projeto é uma aplicação com servidor, e o build atual é gerado para o ambiente do Lovable. Vou adicionar a configuração de deploy para a Vercel (`vercel.json` + alvo de build do adaptador Vercel no `vite.config.ts`), mantendo o build do Lovable funcionando em paralelo. Assim o mesmo repositório serve nos dois lugares.
3. **GitHub → Vercel**: na Vercel você importa o repositório. O framework é detectado a partir do Vite; o comando de build e o diretório de saída já vêm definidos pelo `vercel.json` que eu incluo.
4. **Variáveis de ambiente na Vercel**: o Lovable Cloud gera as credenciais do backend (URL do projeto e chave publicável, além das chaves de servidor). Elas precisam ser copiadas para Settings → Environment Variables na Vercel, senão o site sobe mas não conecta ao banco nem ao login. Vou deixar no repositório um `.env.example` listando exatamente quais variáveis colar, e um arquivo `DEPLOY.md` com o passo a passo.
5. **Login Google**: a URL da Vercel (e o domínio final, quando houver) precisa ser adicionada às URLs de redirecionamento autorizadas na configuração de autenticação do Cloud. Sem isso o Google devolve erro de redirect. Também está no `DEPLOY.md`.

Observações honestas:

- **GitHub Pages não serve este projeto** — ele tem servidor. GitHub aqui é repositório, não hospedagem.
- O banco e a autenticação continuam no **Lovable Cloud** mesmo quando o site está na Vercel; a Vercel hospeda a aplicação, não os dados.
- Sugiro publicar primeiro pelo Lovable (um clique, tudo já ligado) e usar a Vercel em paralelo, para você validar a cadeia sem risco de ficar sem ambiente funcionando.
- Enquanto não houver código de aplicação, o deploy na Vercel serve só de esqueleto. Posso fazer o ajuste de deploy agora e seguir para as telas do MVP na mesma etapa.


## Fora do que eu faço

Os textos de /privacidade, /termos e /diretrizes serão escritos como rascunho de trabalho baseado nas suas próprias notas, para você revisar como jurista. Não afirmarei conformidade, certificação ou adequação legal em nome da plataforma.
