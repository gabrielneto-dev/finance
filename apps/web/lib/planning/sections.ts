// Páginas da aba Planejamento, compartilhadas pelo servidor e pelo cliente (SPEC-0004, REQ-010).
export const SECTIONS = [
  ["mes", "Mês"], ["caixinhas", "Caixinhas"], ["metas", "Metas"],
  ["projecoes", "Projeções"], ["patrimonio", "Patrimônio"], ["negocio", "Negócio"],
] as const;
export type PlanningSection = typeof SECTIONS[number][0];
export const HORIZONS = [12, 24] as const;
