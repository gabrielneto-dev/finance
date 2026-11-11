// Categorias em português usadas nas Análises e em Gastos (SPEC-0003, REQ-002).
// A Pluggy devolve a categoria em inglês. Cada nome é ligado a uma categoria local,
// que pertence a um grupo com natureza essencial ou de estilo de vida.

/** @typedef {"essencial" | "estilo"} Nature */
/** @typedef {{ id: string; label: string; nature: Nature | null }} Group */
/** @typedef {{ id: string; label: string; group: string; direction: "DEBIT" | "CREDIT"; pluggy: string[] }} Category */

/** @type {Group[]} */
export const GROUPS = [
  { id: "casa", label: "Mercado e casa", nature: "essencial" },
  { id: "transporte", label: "Transporte", nature: "essencial" },
  { id: "saude", label: "Saúde", nature: "essencial" },
  { id: "educacao", label: "Educação", nature: "essencial" },
  { id: "taxas", label: "Taxas, impostos e seguros", nature: "essencial" },
  { id: "alimentacao", label: "Alimentação fora", nature: "estilo" },
  { id: "compras", label: "Compras", nature: "estilo" },
  { id: "assinaturas", label: "Assinaturas e serviços", nature: "estilo" },
  { id: "lazer", label: "Lazer e bem-estar", nature: "estilo" },
  { id: "terceiros", label: "Pix e transferências a terceiros", nature: null },
  { id: "outros", label: "Sem categoria", nature: null },
  { id: "entradas", label: "Entradas", nature: null },
  // Compra e venda feita pelas mesmas contas (SPEC-0004, REQ-001). Fica fora das finanças pessoais.
  { id: "negocio", label: "Negócio", nature: null },
];

/** @type {Category[]} */
export const CATEGORIES = [
  { id: "mercado", label: "Mercado", group: "casa", direction: "DEBIT", pluggy: ["Groceries"] },
  { id: "contas", label: "Contas da casa", group: "casa", direction: "DEBIT",
    pluggy: ["Utilities", "Water", "Electricity", "Gas", "Internet", "Telecommunications", "Mobile", "TV", "Housing", "Rent", "Urban land and building tax"] },
  { id: "casa", label: "Casa e utilidades", group: "casa", direction: "DEBIT", pluggy: ["Houseware", "Home improvement"] },
  { id: "combustivel", label: "Combustível", group: "transporte", direction: "DEBIT", pluggy: ["Gas stations"] },
  { id: "veiculo", label: "Veículo", group: "transporte", direction: "DEBIT",
    pluggy: ["Automotive", "Vehicle maintenance", "Parking", "Tolls and in vehicle payment", "Vehicle ownership taxes and fees", "Traffic tickets"] },
  { id: "mobilidade", label: "Apps e transporte público", group: "transporte", direction: "DEBIT",
    pluggy: ["Transportation", "Taxi and ride-hailing", "Public transportation", "Bus tickets", "Car rental", "Bicycle"] },
  { id: "saude", label: "Saúde e farmácia", group: "saude", direction: "DEBIT",
    pluggy: ["Healthcare", "Pharmacy", "Dentist", "Optometry", "Hospital clinics and labs"] },
  { id: "educacao", label: "Educação", group: "educacao", direction: "DEBIT",
    pluggy: ["Education", "Online courses", "University", "School", "Kindergarten"] },
  { id: "iof", label: "IOF, juros e tarifas", group: "taxas", direction: "DEBIT",
    pluggy: ["Tax on financial operations", "Taxes", "Income taxes", "Tax on investments", "Bank fees", "Account fees",
      "Wire transfer fees and ATM fees", "Credit card fees", "Interests charged", "Late payment and overdraft costs"] },
  { id: "seguros", label: "Seguros", group: "taxas", direction: "DEBIT",
    pluggy: ["Insurance", "Life insurance", "Home insurance", "Health insurance", "Vehicle insurance"] },
  { id: "restaurantes", label: "Restaurantes e bares", group: "alimentacao", direction: "DEBIT", pluggy: ["Eating out", "Food and drinks"] },
  { id: "delivery", label: "Delivery", group: "alimentacao", direction: "DEBIT", pluggy: ["Food delivery"] },
  { id: "compras", label: "Compras em geral", group: "compras", direction: "DEBIT", pluggy: ["Shopping", "Online shopping", "Office supplies", "Sports goods"] },
  { id: "roupas", label: "Roupas", group: "compras", direction: "DEBIT", pluggy: ["Clothing"] },
  { id: "eletronicos", label: "Eletrônicos", group: "compras", direction: "DEBIT", pluggy: ["Electronics"] },
  { id: "livros", label: "Livros e papelaria", group: "compras", direction: "DEBIT", pluggy: ["Bookstore"] },
  { id: "infantil", label: "Infantil", group: "compras", direction: "DEBIT", pluggy: ["Kids and toys"] },
  { id: "pets", label: "Pets", group: "compras", direction: "DEBIT", pluggy: ["Pet supplies and vet"] },
  { id: "assinaturas", label: "Assinaturas digitais", group: "assinaturas", direction: "DEBIT",
    pluggy: ["Digital services", "Video streaming", "Music streaming", "Gaming"] },
  { id: "servicos", label: "Serviços", group: "assinaturas", direction: "DEBIT", pluggy: ["Services"] },
  { id: "academia", label: "Academia e bem-estar", group: "lazer", direction: "DEBIT",
    pluggy: ["Wellness and fitness", "Gyms and fitness centers", "Sports practice", "Wellness"] },
  { id: "lazer", label: "Lazer e cultura", group: "lazer", direction: "DEBIT",
    pluggy: ["Leisure", "Entertainment", "Tickets", "Stadiums and arenas", "Landmarks and museums", "Cinema, theater and concerts"] },
  { id: "viagem", label: "Viagem", group: "lazer", direction: "DEBIT", pluggy: ["Travel", "Airport and airlines", "Accomodation", "Mileage programs"] },
  { id: "apostas", label: "Apostas e loterias", group: "lazer", direction: "DEBIT", pluggy: ["Gambling", "Lottery", "Online bet"] },
  { id: "doacoes", label: "Doações", group: "lazer", direction: "DEBIT", pluggy: ["Donations"] },
  { id: "pix", label: "Pix e transferências", group: "terceiros", direction: "DEBIT",
    pluggy: ["Transfer - PIX", "Transfers", "Third party transfers", "Transfer - TED", "Transfer - DOC", "Transfer - Bank Slip", "Alimony"] },
  { id: "sem", label: "Sem categoria", group: "outros", direction: "DEBIT", pluggy: [] },
  { id: "salario", label: "Salário", group: "entradas", direction: "CREDIT", pluggy: ["Salary", "Income", "Entrepreneurial activities", "Retirement", "Government aid"] },
  { id: "rendimentos", label: "Rendimentos", group: "entradas", direction: "CREDIT", pluggy: ["Proceeds interests and dividends"] },
  { id: "recebidos", label: "Pix e transferências recebidas", group: "entradas", direction: "CREDIT",
    pluggy: ["Transfer - PIX", "Transfers", "Third party transfers", "Transfer - TED", "Transfer - DOC", "Transfer - Cash", "Transfer - Check", "Transfer - Bank Slip"] },
  { id: "outras", label: "Outras entradas", group: "entradas", direction: "CREDIT", pluggy: ["Non-recurring income", "Cashback"] },
  { id: "negocio_vendas", label: "Vendas do negócio", group: "negocio", direction: "CREDIT", pluggy: [] },
  { id: "negocio_mercadoria", label: "Compra de mercadoria", group: "negocio", direction: "DEBIT", pluggy: [] },
  { id: "negocio_frete", label: "Frete e envio", group: "negocio", direction: "DEBIT", pluggy: [] },
  { id: "negocio_taxas", label: "Taxas e plataformas", group: "negocio", direction: "DEBIT", pluggy: [] },
  { id: "negocio_outros", label: "Outros custos do negócio", group: "negocio", direction: "DEBIT", pluggy: [] },
];

/** Grupo das categorias de compra e venda (SPEC-0004, REQ-001). */
export const BUSINESS_GROUP = "negocio";

// Categorias da Pluggy que não são consumo nem renda. Ficam fora de despesas e receitas.
export const NEUTRAL = {
  pagamento_fatura: ["Credit card payment"],
  transferencia_propria: ["Same person transfer", "Same person transfer - CASH", "Transfer - Internal"],
  investimento: ["Investments", "Automatic investment", "Fixed income", "Mutual funds", "Variable income", "Margin", "Pension"],
  emprestimo: ["Loans and financing", "Financing", "Real estate financing", "Vehicle financing", "Student loan"],
};

// Escolhas especiais do usuário, além das categorias.
export const SPECIAL_CHOICES = {
  ignorar: { label: "Ignorar nas análises", kind: "ignorado" },
  propria: { label: "Transferência entre minhas contas", kind: "transferencia_propria" },
  aporte: { label: "Aporte em investimento", kind: "investimento" },
  retirada: { label: "Retirada do negócio", kind: "transferencia_propria" },
};

const byId = new Map(CATEGORIES.map((row) => [row.id, row]));
const groupById = new Map(GROUPS.map((row) => [row.id, row]));
const lookup = { DEBIT: new Map(), CREDIT: new Map() };
for (const row of CATEGORIES) for (const name of row.pluggy) lookup[row.direction].set(name, row.id);
const neutral = new Map(Object.entries(NEUTRAL).flatMap(([kind, names]) => names.map((name) => [name, kind])));

/** @param {string} id */
export const categoryById = (id) => byId.get(id) ?? null;
/** @param {string} id */
export const groupOf = (id) => groupById.get(id) ?? null;

/**
 * Categoria local para o nome da Pluggy, na direção do lançamento.
 * Devolve null quando o nome não está no mapa.
 * @param {string | null | undefined} name
 * @param {"DEBIT" | "CREDIT"} direction
 */
export function pluggyCategory(name, direction) {
  if (!name) return null;
  return lookup[direction].get(name) ?? (direction === "CREDIT" ? lookup.DEBIT.get(name) : null) ?? null;
}

/** @param {string | null | undefined} name */
export const neutralKind = (name) => (name ? neutral.get(name) ?? null : null);

/** Escolha aceita pela ação de categorizar: id de categoria ou escolha especial. */
export const isChoice = (/** @type {unknown} */ value) =>
  typeof value === "string" && (byId.has(value) || Object.hasOwn(SPECIAL_CHOICES, value));
