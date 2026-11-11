// Páginas da aba Análises, compartilhadas pelo servidor e pelo cliente (SPEC-0003, REQ-005).
export const SECTIONS = [
  ["resumo", "Resumo"], ["fluxo", "Fluxo de caixa"], ["categorias", "Categorias"],
  ["faturas", "Faturas"], ["instituicoes", "Instituições"], ["habitos", "Hábitos"],
] as const;
export type AnalyticsSection = typeof SECTIONS[number][0];
