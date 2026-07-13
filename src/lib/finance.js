export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const CATEGORIES = [
  "Moradia", "Aluguel", "Condomínio", "Financiamento", "Financiamento imobiliário", "Financiamento veículo",
  "Água", "Luz", "Gás", "Internet", "Telefone", "Celular", "TV e streaming", "Casa", "Móveis",
  "Eletrodomésticos", "Manutenção residencial", "Limpeza", "Transporte", "Carro", "Moto", "Gasolina",
  "Etanol", "Diesel", "Estacionamento", "Pedágio", "Seguro veículo", "IPVA", "Licenciamento", "Multas",
  "Manutenção veículo", "Mecânico", "Pneus", "Uber e táxi", "Transporte público", "Alimentação", "Mercado",
  "Feira", "Padaria", "Restaurante", "Delivery", "Lanches", "Saúde", "Hospital", "Consulta médica", "Exames",
  "Remédios", "Farmácia", "Plano de saúde", "Dentista", "Psicólogo", "Academia", "Bem-estar", "Educação",
  "Escola", "Faculdade", "Cursos", "Livros", "Material escolar", "Filhos", "Creche", "Pets", "Ração",
  "Veterinário", "Higiene pet", "Roupas", "Calçados", "Beleza", "Barbearia", "Salão", "Viagem",
  "Hospedagem", "Passagens", "Lazer", "Assinaturas", "Presentes", "Doações", "Impostos", "Taxas", "Banco",
  "Cartão de crédito", "Empréstimo", "Dívidas", "Investimentos", "Seguro", "Emergência", "Trabalho", "Outros",
].sort((a, b) => a.localeCompare(b, "pt-BR"));

export function getCanonicalCategory(value) {
  const category = String(value || "").trim();
  if (!category) {
    return "Outros";
  }

  const normalized = normalizeText(category);
  return CATEGORIES.find((item) => normalizeText(item) === normalized) || category;
}

export const STATUSES = ["aguardando", "pago", "atrasado"];

export const STATUS_LABELS = {
  aguardando: "Não pago",
  pago: "Pago",
  atrasado: "Atrasado",
};

export function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function getBrasiliaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
}

export function getCurrentTimeLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export function formatMonthYear(year, month) {
  return `${MONTHS[month - 1]} ${year}`;
}

export function getMonthKey(month) {
  return String(month).padStart(2, "0");
}

export function getNextMonth(year, month) {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

export function calculateSummary(salary, expenses) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.value || 0), 0);
  const balance = Number(salary || 0) - total;
  return {
    total,
    balance,
    dailyBalance: balance / 30,
  };
}

export function sortExpenses(expenses) {
  return [...expenses].sort((a, b) => {
    const aDue = a.dueDate === "" ? 99 : Number(a.dueDate);
    const bDue = b.dueDate === "" ? 99 : Number(b.dueDate);
    return aDue - bDue;
  });
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
