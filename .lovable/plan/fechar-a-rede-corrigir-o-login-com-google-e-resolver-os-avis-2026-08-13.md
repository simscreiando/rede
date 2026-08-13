# Fechar a Rede, corrigir o login com Google e resolver os avisos de segurança

Três frentes nesta etapa: uma porta trancada na frente do site inteiro, o conserto do "entrar com Google" e os dois avisos de segurança abertos.

## 1. Porta de entrada (senha do site + convidados)

- Todo o site fica atrás de uma tela de senha, inclusive a home, os textos legais e a página de entrar. Quem não tem a senha vê apenas a tela `/acesso`, com um campo de senha e nada mais.
- A senha é guardada como segredo no servidor (nunca no código nem no navegador) e conferida no servidor. Depois de acertar, uma sessão assinada mantém a pessoa liberada por 7 dias, sem precisar digitar de novo a cada página.
- Segunda camada: lista de convidados por e-mail. Criar conta (e-mail ou Google) e entrar só funcionam se o e-mail estiver na lista. Quem não está recebe uma mensagem clara de "convite necessário" e é desconectada na hora.
- A lista de convidados fica no banco, gerenciada por você em `/admin/convidados` (visível só para quem tem papel de moderação): adicionar e-mail, remover, ver quem já entrou.
- Enquanto o site está fechado, as páginas ficam fora dos buscadores (robots e sitemap ajustados). Quando abrir ao público, isso é revertido.

## 2. Login com Google (o 404)

O que acontece hoje: o login manda a pessoa de volta para `redesaudade.lovable.app`, um endereço que ainda não existe porque o site nunca foi publicado — daí o "404, essa página não existe".

Ordem para resolver:

1. Usar o endereço real onde o site já está no ar pela Vercel: `https://redesaudade.vercel.app`.
2. Registrar esse endereço na configuração de autenticação como destino autorizado do Google, e ajustar o retorno do login para uma rota pública de retorno (`/auth/callback`) que espera a sessão ficar pronta antes de levar a pessoa ao perfil.
3. Confirmar que o provedor Google está ativo na autenticação do projeto.
4. Testar o fluxo completo já publicado: senha do site → entrar com Google → checagem de convite → perfil.

Observação honesta: no preview dentro do editor o Google funciona por uma via própria; o teste que vale é no endereço publicado.

## 3. Avisos de segurança abertos

- **Comunidades fechadas aparecem para qualquer pessoa logada**: hoje qualquer conta autenticada lê nome, descrição e criador de todas as comunidades, mesmo as fechadas. Vou restringir a leitura a comunidades abertas, comunidades das quais a pessoa participa, e à moderação — igual já vale para tópicos e mensagens. As telas de lista e de criação de comunidade acompanham a mudança.
- **Aviso sobre o grafo de amizades**: já está correto no banco (só quem participa vê a linha). Vou reconfirmar a regra e registrar isso na memória de segurança para o alerta não voltar como falso positivo.

## Detalhes técnicos

- Porta: `createServerFn` conferindo a senha com comparação de tempo constante contra `SITE_PASSWORD` (segredo do servidor) e sessão criptografada via `useSession` com `SESSION_SECRET` (gerado automaticamente, nunca inventado à mão). Rota `/acesso` liberada; um layout de proteção redireciona todo o resto.
- Convidados: tabela `invited_emails` (e-mail normalizado, quem convidou, data, data de uso) com RLS — leitura/escrita apenas para moderação, checagem feita em função no servidor. Verificação no primeiro login e a cada entrada.
- Google: `redirect_uri` passa a ser `${window.location.origin}/auth/callback` (rota pública), com o destino pretendido guardado à parte e navegação só após a sessão existir.
- Comunidades: nova política de leitura em `public.communities` usando as funções privadas de participação já existentes em `app_private`.
- Cadastro por e-mail continua exigindo declaração de 18+; nada disso muda o que já existe de perfis, selos, depoimentos e moderação.
