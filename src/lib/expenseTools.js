import { getBrasiliaDate, getNextMonth, STATUSES } from "./finance.js";

export const FIXED_RECURRENCE_MONTHS = 24;

export function addMonths(year, month, offset) {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function parseMoneyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value || "")
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$/i, "");

  if (!text) {
    return 0;
  }

  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  if (STATUSES.includes(text)) {
    return text;
  }
  if (["pago", "paid"].includes(text)) {
    return "pago";
  }
  if (["atrasado", "vencido"].includes(text)) {
    return "atrasado";
  }
  return "aguardando";
}

export function getInstallmentCount(value) {
  const text = String(value || "").trim();
  const match = text.match(/(?:\d+\s*\/\s*)?(\d+)/);
  const count = match ? Number(match[1]) : 0;
  return Number.isInteger(count) && count > 1 ? count : 0;
}

export function parseDueDateValue(value, selected, today = getBrasiliaDate()) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return buildDueDate(Number(isoMatch[3]), Number(isoMatch[2]), Number(isoMatch[1]));
  }

  const brMatch = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (brMatch) {
    const year = brMatch[3] ? normalizeYear(Number(brMatch[3])) : selected.year;
    return buildDueDate(Number(brMatch[1]), Number(brMatch[2]), year);
  }

  const dayMatch = text.match(/(?:dia\s*)?(\d{1,2})/i);
  if (!dayMatch) {
    return null;
  }

  const day = Number(dayMatch[1]);
  const selectedIsCurrent = selected.year === today.getFullYear() && selected.month === today.getMonth() + 1;
  const target = selectedIsCurrent && day < today.getDate() ? getNextMonth(selected.year, selected.month) : selected;
  return buildDueDate(day, target.month, target.year);
}

export function validateExpenseDraft(draft) {
  const errors = [];
  if (!String(draft.name || "").trim()) {
    errors.push("Descrição obrigatória");
  }
  if (parseMoneyValue(draft.value) <= 0) {
    errors.push("Valor obrigatório");
  }
  if (!draft.dueDate || Number(draft.dueDate) < 1 || Number(draft.dueDate) > 31) {
    errors.push("Vencimento obrigatório");
  }
  return errors;
}

export function normalizeExpenseDraft(draft, selected) {
  const due = parseDueDateValue(draft.dueDate, selected);
  return {
    name: String(draft.name || "").trim(),
    category: draft.category || "Outros",
    value: parseMoneyValue(draft.value),
    dueDate: due?.day || "",
    dueYear: due?.year || selected.year,
    dueMonth: due?.month || selected.month,
    installment: String(draft.installment || "").trim(),
    status: normalizeStatus(draft.status),
    debtBalance: draft.debtBalance === "" || draft.debtBalance === undefined ? "" : parseMoneyValue(draft.debtBalance),
    note: String(draft.note || "").trim(),
  };
}

export function makeExpense(draft, id) {
  return {
    id,
    name: draft.name,
    category: draft.category || "Outros",
    value: Number(draft.value || 0),
    dueDate: draft.dueDate === "" ? "" : Number(draft.dueDate),
    installment: draft.installment || "",
    status: draft.status || "aguardando",
    debtBalance: draft.debtBalance === "" ? "" : Number(draft.debtBalance || 0),
    note: draft.note || "",
  };
}

export function generateInstallmentDrafts(baseDraft, selected) {
  const normalized = normalizeExpenseDraft(baseDraft, selected);
  const count = getInstallmentCount(baseDraft.installment);
  const debtTotal = parseMoneyValue(baseDraft.debtBalance);

  if (!count || debtTotal <= 0) {
    return [normalized];
  }

  const installmentValue = roundMoney(debtTotal / count);
  return Array.from({ length: count }, (_, index) => {
    const target = addMonths(normalized.dueYear, normalized.dueMonth, index);
    return {
      ...normalized,
      value: installmentValue,
      dueYear: target.year,
      dueMonth: target.month,
      installment: `${index + 1}/${count}`,
    };
  });
}

export function generateRecurringDrafts(baseDraft, selected, options) {
  const normalized = normalizeExpenseDraft(baseDraft, selected);
  const count = options.fixed ? FIXED_RECURRENCE_MONTHS : Math.max(1, Number(options.months || 1));

  return Array.from({ length: count }, (_, index) => {
    const target = addMonths(normalized.dueYear, normalized.dueMonth, index);
    return {
      ...normalized,
      dueYear: target.year,
      dueMonth: target.month,
      note: [normalized.note, options.fixed ? "Recorrente fixa" : ""].filter(Boolean).join(" - "),
    };
  });
}

export function parseTextExpenses(text, selected) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseTextLine(line, selected));
}

export function parseCsvExpenses(text, selected) {
  const rows = parseCsv(String(text || ""));
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim())).map((row) => {
    const data = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    return normalizeImportedDraft(
      {
        name: data.descricao,
        category: data.categoria || "Outros",
        value: data.valor,
        dueDate: data.vencimento,
        status: data.status || "aguardando",
        note: data.observacao,
      },
      selected,
    );
  });
}

export function normalizeImportedDraft(draft, selected) {
  const normalized = normalizeExpenseDraft(draft, selected);
  const errors = validateExpenseDraft(normalized);
  return { ...normalized, errors };
}

export function groupDraftsByMonth(drafts) {
  return drafts.reduce((groups, draft) => {
    const key = `${draft.dueYear}-${String(draft.dueMonth).padStart(2, "0")}`;
    groups[key] = groups[key] || { year: draft.dueYear, month: draft.dueMonth, drafts: [] };
    groups[key].drafts.push(draft);
    return groups;
  }, {});
}

function parseTextLine(line, selected) {
  const dueMatch = line.match(/(?:vence|vencimento|dia)\s*(?:dia\s*)?(\d{1,2}(?:[/-]\d{1,2}(?:[/-]\d{2,4})?)?)/i);
  const valueMatch = line.match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|(?:R\$\s*)?\d+(?:,\d{2})?/);
  const dueText = dueMatch?.[1] || "";
  const valueText = valueMatch?.[0] || "";
  const name = line
    .replace(dueMatch?.[0] || "", "")
    .replace(valueText, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalizeImportedDraft(
    {
      name,
      category: "Outros",
      value: valueText,
      dueDate: dueText,
      status: "aguardando",
      note: "",
    },
    selected,
  );
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildDueDate(day, month, year) {
  if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return null;
  }
  return { day, month, year };
}

function normalizeYear(year) {
  return year < 100 ? 2000 + year : year;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
