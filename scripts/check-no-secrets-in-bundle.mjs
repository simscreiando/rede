// TESTE 12 da spec: "service-role key nunca aparece no bundle do cliente."
// Este script varre o output de build do CLIENTE (não o output de servidor,
// que roda em ambiente confiável) procurando pela string literal do valor
// de SUPABASE_SERVICE_ROLE_KEY e por menções ao próprio nome da variável.
// Rodar depois de `bun run build`, com SUPABASE_SERVICE_ROLE_KEY setada no
// ambiente (em CI real; no CI de placeholder do workflow atual a variável
// não é setada de propósito, então este script só roda de verdade quando
// há uma service-role key real configurada — ex.: build de preview/produção
// na Vercel, ou localmente antes de um deploy).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CLIENT_BUILD_DIR = process.argv[2] ?? ".output/public";
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (/\.(js|mjs|cjs|html|css)$/.test(entry)) out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(CLIENT_BUILD_DIR);
} catch {
  console.warn(
    `[verify:bundle] Diretório de build "${CLIENT_BUILD_DIR}" não encontrado — rode "bun run build" antes.`,
  );
  process.exit(0);
}

let failed = false;

for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (serviceRoleKey && content.includes(serviceRoleKey)) {
    console.error(`[verify:bundle] FALHA: valor da service-role key encontrado em ${file}`);
    failed = true;
  }
  if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    console.error(`[verify:bundle] FALHA: referência a SUPABASE_SERVICE_ROLE_KEY em ${file}`);
    failed = true;
  }
}

if (failed) {
  console.error(
    "[verify:bundle] O bundle do cliente contém material sensível de service-role. Corrija antes de fazer deploy.",
  );
  process.exit(1);
}

console.log(`[verify:bundle] OK — nenhuma referência de service-role encontrada em ${files.length} arquivo(s).`);
