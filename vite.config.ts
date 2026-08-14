import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Configuração própria da Saudade Social — sem @lovable.dev/vite-tanstack-config.
// O preset do Nitro é explicitamente "vercel" (deploy alvo definido na spec),
// não o "cloudflare" que vinha por padrão na configuração anterior.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      target: "vercel",
      server: {
        entry: "server",
      },
    }),
    viteReact(),
  ],
  server: {
    port: 3000,
  },
});
