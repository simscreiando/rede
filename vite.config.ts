import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// CORREÇÃO (investigação Vercel — branch 03): a configuração anterior usava
// `tanstackStart({ target: "vercel", server: { entry: "server" } })`, uma
// API de uma geração anterior da integração TanStack Start + Nitro. O
// caminho oficial atual (confirmado na documentação do TanStack Start, no
// guia da Vercel para TanStack Start, e no guia de deploy do TanStack
// Router para Vercel, todos consultados nesta investigação) é diferente:
//   1. `tanstackStart()` é chamado SEM as opções `target`/`server.entry` —
//      esse "modo de entry customizada" pertence a uma API mais antiga e,
//      combinado com a versão atual de @tanstack/react-start (1.168.x) e
//      do pacote `nitro` (3.x, baseado em h3 v2 + rou3 + srvx), é a causa
//      mais provável do TypeError "Cannot read properties of undefined
//      (reading 'pathname')" dentro de H3Event: o entry customizado que
//      isso apontava (src/server.ts, removido nesta correção) não produz
//      o objeto de requisição no formato que o Nitro v3 (h3 v2) espera.
//   2. O Nitro entra como um PLUGIN PRÓPRIO, separado, importado de
//      "nitro/vite" — não como uma opção dentro de tanstackStart(). É o
//      plugin nitro() que detecta e configura o preset da Vercel
//      automaticamente (não existe mais um "target: 'vercel'" a passar).
// Sem o plugin nitro() (estado 1 do relatório da Vercel), TanStack Start
// usa seu entry SSR padrão, que não está adaptado ao runtime da Vercel —
// daí o 404. Com a opção antiga target/server.entry (estado 2), o Nitro é
// acionado por um caminho incompatível com a versão atual, produzindo um
// evento H3 malformado — daí o 500.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
  server: {
    port: 3000,
  },
});