import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Rede" },
      {
        name: "description",
        content:
          "Termos de uso da Rede: quem pode usar, responsabilidades sobre conteúdo, moderação, recursos e encerramento de conta.",
      },
      { property: "og:title", content: "Termos de uso da Rede" },
      {
        property: "og:description",
        content: "Regras do contrato entre você e a Rede, em linguagem direta.",
      },
      { property: "og:type", content: "article" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <AppShell>
      <article className="paper-card space-y-5 p-6 text-sm leading-relaxed">
        <header>
          <h1 className="text-2xl">Termos de uso</h1>
          <p className="mt-1 text-muted-foreground">
            Versão de trabalho da fase MVP, pendente de revisão jurídica.
          </p>
        </header>

        <section>
          <h2 className="text-lg">Quem pode usar</h2>
          <p className="mt-1">
            Nesta fase, a Rede é destinada a pessoas com 18 anos ou mais. Contas identificadas como
            de crianças ou adolescentes serão encerradas, porque o serviço ainda não implementa as
            salvaguardas exigidas pela legislação de proteção de menores em ambiente digital.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Seu conteúdo</h2>
          <p className="mt-1">
            Você continua titular do que publica e concede à Rede apenas a licença técnica necessária
            para armazenar e exibir esse conteúdo às pessoas que você autorizou. Depoimentos escritos
            sobre você só aparecem no seu perfil depois da sua aprovação, e você pode removê-los
            depois.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Condutas vedadas</h2>
          <p className="mt-1">
            É proibido publicar conteúdo ilícito, discurso de ódio, assédio, exposição de dados
            pessoais de terceiros, material sexual envolvendo menores, incitação à violência, fraude
            e spam. Detalhes nas{" "}
            <Link to="/diretrizes" className="underline">
              diretrizes de convivência
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg">Moderação e devido processo</h2>
          <p className="mt-1">
            Denúncias passam por triagem e análise humana. Toda decisão de remoção ou suspensão é
            registrada com justificativa e comunicada à pessoa afetada, que pode apresentar recurso.
            Conteúdos com ordem judicial de remoção são tratados conforme o Marco Civil da Internet.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Encerramento</h2>
          <p className="mt-1">
            Você pode encerrar sua conta quando quiser em{" "}
            <Link to="/configuracoes/dados" className="underline">
              Meus dados
            </Link>
            . A Rede pode suspender contas em caso de violação grave ou reiterada destes termos,
            sempre com registro do motivo.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Sem garantias de disponibilidade</h2>
          <p className="mt-1">
            Este é um projeto em construção, oferecido sem garantia de disponibilidade contínua. Faça
            cópias do que for importante para você usando a exportação de dados.
          </p>
        </section>
      </article>
    </AppShell>
  );
}
