import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/diretrizes")({
  head: () => ({
    meta: [
      { title: "Diretrizes de convivência — Rede" },
      {
        name: "description",
        content:
          "O que é aceitável na Rede, como funcionam denúncias, quais medidas a moderação pode aplicar e como pedir recurso.",
      },
      { property: "og:title", content: "Diretrizes de convivência da Rede" },
      {
        property: "og:description",
        content: "Regras claras, moderação humana e direito de recurso.",
      },
      { property: "og:type", content: "article" },
    ],
  }),
  component: GuidelinesPage,
});

function GuidelinesPage() {
  return (
    <AppShell>
      <article className="paper-card space-y-5 p-6 text-sm leading-relaxed">
        <header>
          <h1 className="text-2xl">Diretrizes de convivência</h1>
          <p className="mt-1 text-muted-foreground">
            A Rede é pequena de propósito. As regras existem para manter o lugar habitável.
          </p>
        </header>

        <section>
          <h2 className="text-lg">Princípios</h2>
          <ul className="mt-1 list-disc space-y-1 ps-5">
            <li>Sem ranking de pessoas: selos afetivos reconhecem, não classificam.</li>
            <li>Sem feed algorítmico: você vê o que escolheu seguir e acompanhar.</li>
            <li>Consentimento primeiro: amizades e depoimentos dependem de aceite.</li>
            <li>Dados mínimos: preencher o perfil é opcional.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg">Conteúdo não permitido</h2>
          <ul className="mt-1 list-disc space-y-1 ps-5">
            <li>Assédio, perseguição, ameaça e incitação à violência.</li>
            <li>Discurso de ódio contra pessoas ou grupos.</li>
            <li>Exposição de dados pessoais de terceiros sem autorização.</li>
            <li>Conteúdo sexual envolvendo crianças ou adolescentes, em qualquer forma.</li>
            <li>Fraude, golpes, spam e automação para inflar interações.</li>
            <li>Conteúdo que viole direitos autorais de terceiros.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg">Como funciona uma denúncia</h2>
          <ol className="mt-1 list-decimal space-y-1 ps-5">
            <li>Você denuncia o perfil, depoimento, recado, comunidade, tópico ou mensagem.</li>
            <li>A denúncia entra na fila de triagem com data e motivo registrados.</li>
            <li>Uma pessoa da moderação analisa e decide, sempre com justificativa escrita.</li>
            <li>Quem denunciou e quem foi denunciado recebem a decisão.</li>
            <li>Cabe recurso, analisado por outra pessoa quando possível.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg">Medidas possíveis</h2>
          <p className="mt-1">
            Aviso, remoção do conteúdo, limitação temporária de publicação, suspensão da conta e,
            nos casos mais graves, encerramento definitivo. A medida deve ser proporcional ao que
            aconteceu, e o histórico fica registrado para auditoria interna.
          </p>
        </section>

        <section>
          <h2 className="text-lg">Depoimentos</h2>
          <p className="mt-1">
            Depoimento é elogio afetuoso, não avaliação pública de reputação. Nada aparece no perfil
            de alguém sem que essa pessoa aprove, e ela pode remover depois — inclusive anos depois.
          </p>
        </section>
      </article>
    </AppShell>
  );
}
