import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Aviso de privacidade — Rede" },
      {
        name: "description",
        content:
          "Como a Rede trata dados pessoais: bases legais da LGPD, dados coletados, retenção, compartilhamento e seus direitos.",
      },
      { property: "og:title", content: "Aviso de privacidade da Rede" },
      {
        property: "og:description",
        content: "Transparência sobre dados, retenção e direitos do titular na LGPD.",
      },
      { property: "og:type", content: "article" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <AppShell>
      <article className="paper-card space-y-5 p-6 text-sm leading-relaxed">
        <header>
          <h1 className="text-2xl">Aviso de privacidade</h1>
          <p className="mt-1 text-muted-foreground">
            Versão de trabalho da fase MVP. Este texto precisa de revisão jurídica antes de abrir a
            Rede ao público.
          </p>
        </header>

        <section>
          <h2 className="text-lg">Quais dados tratamos</h2>
          <p className="mt-1">
            Dados de conta (e-mail e identificador), dados de perfil que você escolhe preencher
            (nome de exibição, apelido, cidade, bio, foto), conteúdos que você publica (depoimentos,
            recados, tópicos, mensagens), relações de amizade, participações em comunidades, selos
            afetivos e registros de denúncia e moderação.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Para que tratamos</h2>
          <ul className="mt-1 list-disc space-y-1 ps-5">
            <li>Executar o serviço que você pediu ao criar a conta (art. 7º, V da LGPD).</li>
            <li>
              Cumprir obrigações legais e regulatórias, incluindo guarda de registros de acesso
              prevista no Marco Civil da Internet (art. 7º, II).
            </li>
            <li>
              Manter a segurança e a integridade da plataforma e apurar denúncias, com base em
              legítimo interesse avaliado e documentado (art. 7º, IX).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg">O que não fazemos</h2>
          <p className="mt-1">
            A Rede não faz publicidade comportamental, não vende dados pessoais, não constrói perfis
            para recomendação algorítmica de conteúdo e não usa seus dados para treinar modelos de
            inteligência artificial.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Retenção</h2>
          <p className="mt-1">
            Conteúdos ficam disponíveis enquanto a conta existir. Ao apagar a conta, perfil e
            conteúdos são eliminados; registros de moderação e de acesso podem ser mantidos de forma
            pseudonimizada pelos prazos legais aplicáveis.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Seus direitos</h2>
          <p className="mt-1">
            Você pode acessar, corrigir, exportar e eliminar seus dados diretamente em{" "}
            <Link to="/configuracoes/dados" className="underline">
              Meus dados
            </Link>
            . Pedidos que não puderem ser atendidos em autoatendimento serão respondidos pelo canal
            de contato do encarregado de dados, a ser publicado antes da abertura ao público.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Operadores e transferência internacional</h2>
          <p className="mt-1">
            A Rede usa serviços de hospedagem, banco de dados e autenticação de terceiros, que podem
            processar dados fora do Brasil. Antes da abertura pública, a lista de operadores e as
            salvaguardas contratuais serão publicadas aqui.
          </p>
        </section>
      </article>
    </AppShell>
  );
}
