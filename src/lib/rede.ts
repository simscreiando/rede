export const APP_NAME = "Rede";

export const BADGE_KINDS = [
  { value: "amizade", label: "Amizade", emoji: "🌼" },
  { value: "admiracao", label: "Admiração", emoji: "🌙" },
  { value: "confianca", label: "Confiança", emoji: "🫖" },
  { value: "parceria", label: "Parceria", emoji: "🧶" },
] as const;

export type BadgeKind = (typeof BADGE_KINDS)[number]["value"];

export function badgeLabel(kind: string) {
  return BADGE_KINDS.find((b) => b.value === kind) ?? { value: kind, label: kind, emoji: "🍂" };
}

export const REPORT_REASONS = [
  { value: "assedio", label: "Assédio" },
  { value: "ameaca", label: "Ameaça" },
  { value: "discurso_ilicito", label: "Discurso ilícito" },
  { value: "exposicao_indevida", label: "Exposição indevida" },
  { value: "conteudo_sexual", label: "Conteúdo sexual" },
  { value: "fraude", label: "Fraude" },
  { value: "impersonificacao", label: "Impersonificação" },
  { value: "direito_autoral", label: "Violação de direito autoral" },
  { value: "privacidade", label: "Violação de privacidade" },
  { value: "spam", label: "Spam" },
  { value: "outro", label: "Outro" },
] as const;

export function reasonLabel(value: string) {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}

export type ReportTargetType =
  | "profile"
  | "testimonial"
  | "scrap"
  | "community"
  | "topic"
  | "post";

export function initials(name: string | null | undefined) {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}
