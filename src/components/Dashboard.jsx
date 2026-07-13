import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  TableContainer,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Textarea,
  useColorMode,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { AddIcon, CheckIcon, DeleteIcon, EditIcon, MoonIcon, SettingsIcon, SunIcon, ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import HeroCard from "./HeroCard.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import { notify } from "../toast.js";
import {
  getLegacyMigrationSummary,
  loadAllFinanceMonths,
  loadFinanceMonth,
  migrateLegacyAccount,
  saveFinanceMonth,
} from "../lib/cloudFinance.js";
import { ADMIN_EMAIL, ADMIN_USERNAME, normalizeUsername, supabase, usernameToAuthEmail } from "../lib/supabase.js";
import { clearLegacySession } from "../lib/legacyAuth.js";
import {
  calculateSummary,
  CATEGORIES,
  formatMoney,
  formatMonthYear,
  getBrasiliaDate,
  getCanonicalCategory,
  getCurrentTimeLabel,
  getNextMonth,
  MONTHS,
  sortExpenses,
  STATUSES,
  STATUS_LABELS,
} from "../lib/finance.js";
import { getAllLocalFinanceMonths, getExpenses, getSalary, saveExpenses, saveSalary } from "../lib/storage.js";
import {
  FIXED_RECURRENCE_MONTHS,
  generateInstallmentDrafts,
  generateRecurringDrafts,
  groupDraftsByMonth,
  makeExpense,
  normalizeExpenseDraft,
  normalizeImportedDraft,
  validateExpenseDraft,
} from "../lib/expenseTools.js";

const emptyForm = {
  name: "",
  category: "",
  value: "",
  dueDate: "",
  installment: "",
  status: "aguardando",
  debtBalance: "",
  note: "",
  seriesId: "",
};

const emptyBulkRow = {
  name: "",
  category: "",
  value: "",
  dueDate: "",
  status: "aguardando",
  note: "",
};

const EXPENSE_COLUMNS_KEY = "finance_expense_columns";
const expenseColumns = [
  { key: "category", label: "Categoria" },
  { key: "value", label: "Valor", numeric: true },
  { key: "debtBalance", label: "Dívida total", numeric: true },
  { key: "dueDate", label: "Vencimento" },
  { key: "installment", label: "Parcela" },
  { key: "status", label: "Status" },
  { key: "note", label: "Observação" },
];
const defaultExpenseColumns = ["category", "value", "dueDate", "installment", "status", "note"];

export default function Dashboard({ user, onUserUpdate, onLogout }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const mutedText = useColorModeValue("gray.600", "gray.300");
  const softText = useColorModeValue("gray.500", "gray.400");
  const subtleBg = useColorModeValue("whiteAlpha.700", "whiteAlpha.100");
  const mobileItemBg = useColorModeValue("whiteAlpha.800", "whiteAlpha.100");
  const mobileItemBorder = useColorModeValue("gray.100", "whiteAlpha.200");
  const logoutBg = useColorModeValue("rose.50", "rgba(159, 18, 57, 0.24)");
  const logoutBorder = useColorModeValue("rose.200", "rose.700");
  const logoutColor = useColorModeValue("rose.700", "rose.200");
  const userDisplayBg = useColorModeValue("brand.50", "whiteAlpha.100");
  const userDisplayBorder = useColorModeValue("brand.100", "whiteAlpha.200");
  const paidStatus = {
    bg: useColorModeValue("mint.50", "rgba(20, 107, 66, 0.35)"),
    border: useColorModeValue("mint.300", "mint.600"),
    color: useColorModeValue("mint.800", "mint.100"),
  };
  const unpaidStatus = {
    bg: useColorModeValue("peach.50", "rgba(127, 47, 15, 0.34)"),
    border: useColorModeValue("peach.300", "peach.600"),
    color: useColorModeValue("peach.900", "peach.100"),
  };
  const overdueStatus = {
    bg: useColorModeValue("rose.50", "rgba(136, 19, 55, 0.34)"),
    border: useColorModeValue("rose.300", "rose.600"),
    color: useColorModeValue("rose.800", "rose.100"),
  };
  const brasiliaNow = getBrasiliaDate();
  const [selected, setSelected] = useState({ year: brasiliaNow.getFullYear(), month: brasiliaNow.getMonth() + 1 });
  const [timeLabel, setTimeLabel] = useState(getCurrentTimeLabel());
  const [salary, setSalary] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [sortMode, setSortMode] = useState("dueDate");
  const [expenseTab, setExpenseTab] = useState(0);
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [repeatFixed, setRepeatFixed] = useState(false);
  const [repeatMonths, setRepeatMonths] = useState(3);
  const [bulkRows, setBulkRows] = useState([{ ...emptyBulkRow }, { ...emptyBulkRow }, { ...emptyBulkRow }]);
  const [importPreview, setImportPreview] = useState([]);
  const [previewTitle, setPreviewTitle] = useState("");
  const [visibleExpenseColumns, setVisibleExpenseColumns] = useState(() => {
    try {
      const savedColumns = JSON.parse(localStorage.getItem(EXPENSE_COLUMNS_KEY));
      const validColumns = Array.isArray(savedColumns)
        ? savedColumns.filter((columnKey) => expenseColumns.some((column) => column.key === columnKey))
        : [];

      return validColumns.length > 0 ? validColumns : defaultExpenseColumns;
    } catch {
      return defaultExpenseColumns;
    }
  });
  const [profileForm, setProfileForm] = useState({ username: user.username || "", password: "" });
  const expenseModal = useDisclosure();
  const profileModal = useDisclosure();
  const cancelConfirmationRef = useRef();
  const salarySyncRef = useRef();
  const installmentRepairRef = useRef("");
  const salaryRef = useRef(0);
  const expensesRef = useRef([]);
  const [confirmation, setConfirmation] = useState(null);
  const [destructiveLoading, setDestructiveLoading] = useState(false);
  const adminModal = useDisclosure();
  const legacyModal = useDisclosure();
  const migrationSuccessModal = useDisclosure();
  const initialLegacySummary = user.legacy ? null : getLegacyMigrationSummary(user.id, user.username);
  const [legacySummary, setLegacySummary] = useState(initialLegacySummary);
  const [legacyForm, setLegacyForm] = useState(() => ({
    username: user.legacy ? user.username : initialLegacySummary?.username || "",
    password: user.legacy ? user.legacyPassword : "",
  }));
  const [showLegacyPassword, setShowLegacyPassword] = useState(false);
  const [migratingLegacy, setMigratingLegacy] = useState(false);

  const currentYear = brasiliaNow.getFullYear();
  const currentMonth = brasiliaNow.getMonth() + 1;
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const monthLabel = formatMonthYear(selected.year, selected.month);

  useEffect(() => {
    const interval = window.setInterval(() => setTimeLabel(getCurrentTimeLabel()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    if (user.legacy) {
      const localSalary = getSalary(user.email, selected.year, selected.month);
      const localExpenses = getExpenses(user.email, selected.year, selected.month);
      salaryRef.current = localSalary;
      expensesRef.current = localExpenses;
      setSalary(localSalary);
      setExpenses(localExpenses);
      setEditingId(null);
      setForm(emptyForm);
      return () => { active = false; };
    }
    loadFinanceMonth(user, selected.year, selected.month)
      .then((monthData) => {
        if (!active) return;
        salaryRef.current = monthData.salary;
        expensesRef.current = monthData.expenses;
        setSalary(monthData.salary);
        setExpenses(monthData.expenses);
      })
      .catch((error) => notify({ status: "error", title: "Erro ao carregar o mês", description: error.message }));
    setEditingId(null);
    setForm(emptyForm);
    return () => { active = false; };
  }, [selected, user]);

  useEffect(() => {
    setProfileForm({ username: user.username || "", password: "" });
  }, [user]);

  useEffect(() => {
    if (installmentRepairRef.current === user.id) return;
    installmentRepairRef.current = user.id;
    repairStalledInstallments().catch((error) => {
      installmentRepairRef.current = "";
      notify({ status: "error", title: "Não foi possível atualizar as parcelas antigas", description: error.message });
    });
  }, [user.id]);

  useEffect(() => {
    if (!user.legacy && !legacySummary) return;
    const noticeKey = `legacy_migration_notice_${user.id}`;
    if (!sessionStorage.getItem(noticeKey)) {
      sessionStorage.setItem(noticeKey, "shown");
      legacyModal.onOpen();
    }
  }, [legacySummary, user.id, user.legacy]);

  useEffect(() => {
    if (sessionStorage.getItem("whitecat_migration_success") !== "true") return;
    sessionStorage.removeItem("whitecat_migration_success");
    migrationSuccessModal.onOpen();
  }, []);

  const summary = useMemo(() => calculateSummary(salary, expenses), [salary, expenses]);
  const unpaidTotal = useMemo(
    () => expenses.filter((expense) => expense.status !== "pago").reduce((sum, expense) => sum + Number(expense.value || 0), 0),
    [expenses],
  );
  const sortedExpenses = useMemo(() => {
    if (sortMode === "manual") {
      return expenses;
    }

    if (sortMode === "name") {
      return [...expenses].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }

    if (sortMode === "valueDesc") {
      return [...expenses].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    }

    if (sortMode === "valueAsc") {
      return [...expenses].sort((a, b) => Number(a.value || 0) - Number(b.value || 0));
    }

    if (sortMode === "status") {
      const order = { atrasado: 0, aguardando: 1, pago: 2 };
      return [...expenses].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    }

    if (sortMode === "category") {
      return [...expenses].sort((a, b) => {
        const byCategory = getCanonicalCategory(a.category).localeCompare(getCanonicalCategory(b.category), "pt-BR");
        return byCategory || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      });
    }

    return sortExpenses(expenses);
  }, [expenses, sortMode]);
  const viewingCurrentMonth = selected.year === currentYear && selected.month === currentMonth;
  const today = brasiliaNow.getDate();
  const hasDueToday = expenses.some((expense) => expense.status !== "pago" && Number(expense.dueDate) === today);
  const urgency = !viewingCurrentMonth
    ? { label: "Visualizando outro mês", colorScheme: "sky" }
    : hasDueToday
      ? { label: "Contas vencendo hoje", colorScheme: "peach" }
      : { label: "Nenhuma urgência hoje", colorScheme: "mint" };

  async function persistExpenses(nextExpenses) {
    expensesRef.current = nextExpenses;
    setExpenses(nextExpenses);
    saveExpenses(user.email, selected.year, selected.month, nextExpenses);
    if (user.legacy) return;
    try {
      await saveFinanceMonth(user.id, selected.year, selected.month, salaryRef.current, nextExpenses);
    } catch (error) {
      notify({ status: "error", title: "Falha ao sincronizar", description: error.message });
    }
  }

  function persistSalary(value) {
    const nextSalary = Number(value || 0);
    salaryRef.current = nextSalary;
    setSalary(nextSalary);
    saveSalary(user.email, selected.year, selected.month, nextSalary);
    if (user.legacy) return;
    window.clearTimeout(salarySyncRef.current);
    salarySyncRef.current = window.setTimeout(() => {
      saveFinanceMonth(user.id, selected.year, selected.month, nextSalary, expensesRef.current)
        .catch((error) => notify({ status: "error", title: "Falha ao sincronizar salário", description: error.message }));
    }, 500);
  }

  function saveVisibleExpenseColumns(nextColumns) {
    setVisibleExpenseColumns(nextColumns);
    try {
      localStorage.setItem(EXPENSE_COLUMNS_KEY, JSON.stringify(nextColumns));
    } catch {
      // The current column layout still works for the session when storage is unavailable.
    }
  }

  function toggleExpenseColumn(columnKey) {
    const isVisible = visibleExpenseColumns.includes(columnKey);
    const nextColumns = isVisible
      ? visibleExpenseColumns.filter((item) => item !== columnKey)
      : expenseColumns.filter((column) => [...visibleExpenseColumns, columnKey].includes(column.key)).map((column) => column.key);

    saveVisibleExpenseColumns(nextColumns.length > 0 ? nextColumns : ["value"]);
  }

  function clearImportPreview() {
    setImportPreview([]);
    setPreviewTitle("");
  }

  async function saveDraftsAcrossMonths(drafts) {
    const groups = groupDraftsByMonth(drafts);
    let createdCount = 0;

    for (const group of Object.values(groups)) {
      const currentGroup = group.year === selected.year && group.month === selected.month;
      const monthData = currentGroup
        ? { salary, expenses }
        : user.legacy
          ? { salary: getSalary(user.email, group.year, group.month), expenses: getExpenses(user.email, group.year, group.month) }
          : await loadFinanceMonth(user, group.year, group.month);
      const existingExpenses = monthData.expenses;
      const createdExpenses = group.drafts.map((draft, index) => makeExpense(draft, Date.now() + createdCount + index));
      createdCount += createdExpenses.length;
      const nextExpenses = [...existingExpenses, ...createdExpenses];

      if (currentGroup) {
        await persistExpenses(nextExpenses);
      } else {
        saveExpenses(user.email, group.year, group.month, nextExpenses);
        if (!user.legacy) await saveFinanceMonth(user.id, group.year, group.month, monthData.salary, nextExpenses);
      }
    }

    return createdCount;
  }

  function validateDraftsForSave(drafts) {
    return drafts.flatMap((draft, index) => validateExpenseDraft(draft).map((error) => `Linha ${index + 1}: ${error}`));
  }

  function showPreview(title, drafts) {
    const errors = validateDraftsForSave(drafts);
    setPreviewTitle(title);
    setImportPreview(drafts.map((draft, index) => ({ ...draft, errors: draft.errors?.length ? draft.errors : validateExpenseDraft(draft), previewId: index })));

    if (errors.length > 0) {
      notify({ status: "warning", title: "Revise a prévia", description: errors[0] });
    }
  }

  async function confirmPreview() {
    const errors = validateDraftsForSave(importPreview);
    if (errors.length > 0) {
      notify({ status: "warning", title: "Corrija antes de salvar", description: errors[0] });
      return;
    }

    const count = await saveDraftsAcrossMonths(importPreview);
    clearImportPreview();
    setBulkRows([{ ...emptyBulkRow }, { ...emptyBulkRow }, { ...emptyBulkRow }]);
    expenseModal.onClose();
    notify({ status: "success", title: "Despesas adicionadas", description: `${count} despesa(s) salvas.` });
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    const nextPassword = profileForm.password;

    if (!nextPassword || nextPassword.length < 6) {
      notify({ status: "warning", title: "Revise a senha", description: "Use pelo menos 6 caracteres na nova senha." });
      return;
    }

    const { data, error } = await supabase.auth.updateUser({ password: nextPassword });
    if (error) {
      notify({ status: "error", title: "Não foi possível atualizar", description: error.message });
      return;
    }
    onUserUpdate({ ...user, ...data.user, username: user.username, role: user.role });
    profileModal.onClose();
    notify({ status: "success", title: "Senha atualizada", description: "Use a nova senha no próximo acesso com seu usuário." });
  }

  async function handleLegacyMigration(event) {
    event.preventDefault();
    setMigratingLegacy(true);
    try {
      const result = await migrateLegacyAccount(user, legacyForm.username, legacyForm.password);
      setLegacySummary(null);
      setLegacyForm({ username: "", password: "" });
      legacyModal.onClose();
      const monthData = await loadFinanceMonth(user, selected.year, selected.month);
      salaryRef.current = monthData.salary;
      expensesRef.current = monthData.expenses;
      setSalary(monthData.salary);
      setExpenses(monthData.expenses);
      notify({
        status: "success",
        title: "Planilhas salvas na nuvem",
        description: `${result.months} mês(es) e ${result.expenses} despesa(s) foram preservados.`,
      });
    } catch (error) {
      notify({ status: "error", title: "Não foi possível migrar", description: error.message });
    } finally {
      setMigratingLegacy(false);
    }
  }

  async function upgradeLegacyAccount(event) {
    event.preventDefault();
    if (legacyForm.username.trim() !== user.username || legacyForm.password !== user.legacyPassword) {
      notify({ status: "error", title: "Usuário ou senha incorretos", description: "Digite os mesmos dados usados para entrar neste navegador." });
      return;
    }

    setMigratingLegacy(true);
    const localUsername = normalizeUsername(user.username);
    const isOwner = localUsername === "john" || localUsername === ADMIN_USERNAME;
    const cloudUsername = isOwner ? ADMIN_USERNAME : localUsername;
    const authEmail = isOwner ? ADMIN_EMAIL : usernameToAuthEmail(cloudUsername);
    let authResult = await supabase.auth.signInWithPassword({ email: authEmail, password: legacyForm.password });
    if (authResult.error) {
      authResult = await supabase.auth.signUp({
        email: authEmail,
        password: legacyForm.password,
        options: { data: { username: cloudUsername } },
      });
    }
    if (authResult.error || !authResult.data.session?.user) {
      setMigratingLegacy(false);
      notify({
        status: "error",
        title: "Não foi possível atualizar a conta",
        description: getAccountUpgradeErrorMessage(authResult.error),
      });
      return;
    }
    try {
      await migrateLegacyAccount(authResult.data.session.user, user.username, legacyForm.password);
      clearLegacySession();
      sessionStorage.setItem("whitecat_migration_success", "true");
      window.location.reload();
    } catch (error) {
      setMigratingLegacy(false);
      notify({ status: "error", title: "Não foi possível concluir a atualização", description: error.message });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalized = normalizeExpenseDraft(form, selected);
    const validationErrors = validateExpenseDraft(normalized);
    if (validationErrors.length > 0) {
      notify({ status: "warning", title: "Revise a despesa", description: validationErrors[0] });
      return;
    }

    if (editingId) {
      const editedExpense = makeExpense(normalized, editingId);
      const recurringDrafts = repeatMonthly ? generateRecurringDrafts(form, selected, { fixed: repeatFixed, months: repeatMonths }).slice(1) : [];
      const generatedErrors = validateDraftsForSave(recurringDrafts);

      if (generatedErrors.length > 0) {
        notify({ status: "warning", title: "Revise a despesa", description: generatedErrors[0] });
        return;
      }

      await persistExpenses(expenses.map((expense) => (expense.id === editingId ? editedExpense : expense)));
      if (repeatMonthly) {
        const count = await saveDraftsAcrossMonths(recurringDrafts);
        notify({ status: "success", title: "Despesa atualizada", description: `${count + 1} lançamento(s) salvos.` });
      } else {
        notify({ status: "success", title: "Despesa atualizada" });
      }
    } else {
      const generatedDrafts =
        form.installment
          ? generateInstallmentDrafts(form, selected)
          : repeatMonthly
            ? generateRecurringDrafts(form, selected, { fixed: repeatFixed, months: repeatMonths })
            : [normalized];
      const generatedErrors = validateDraftsForSave(generatedDrafts);

      if (generatedErrors.length > 0) {
        notify({ status: "warning", title: "Revise a despesa", description: generatedErrors[0] });
        return;
      }

      const count = await saveDraftsAcrossMonths(generatedDrafts);
      notify({ status: "success", title: "Despesa adicionada", description: `${count} lançamento(s) salvos.` });
    }

    setForm(emptyForm);
    setEditingId(null);
    setRepeatMonthly(false);
    setRepeatFixed(false);
    setRepeatMonths(3);
    expenseModal.onClose();
  }

  function editExpense(expense) {
    setEditingId(expense.id);
    setExpenseTab(0);
    setForm({
      name: expense.name,
      category: getCanonicalCategory(expense.category),
      value: expense.value,
      dueDate: expense.dueDate,
      installment: expense.installment || "",
      status: expense.status || "aguardando",
      debtBalance: expense.debtBalance || "",
      note: expense.note || "",
      seriesId: expense.seriesId || "",
    });
    expenseModal.onOpen();
  }

  function openNewExpense() {
    setEditingId(null);
    setForm(emptyForm);
    setExpenseTab(0);
    setRepeatMonthly(false);
    setRepeatFixed(false);
    setRepeatMonths(3);
    clearImportPreview();
    expenseModal.onOpen();
  }

  function deleteExpense(id) {
    const expense = expenses.find((item) => item.id === id);
    setConfirmation({
      type: "delete",
      id,
      name: expense?.name || "esta despesa",
      expense,
      deleteSeries: false,
      hasSeries: isSeriesExpense(expense),
    });
  }

  function updateStatus(id, status) {
    persistExpenses(expenses.map((expense) => (expense.id === id ? { ...expense, status } : expense)));
  }

  function updateAllStatuses(status) {
    persistExpenses(expenses.map((expense) => ({ ...expense, status })));
    notify({ status: "success", title: "Status atualizados", description: `Todas as despesas foram marcadas como ${STATUS_LABELS[status]}.` });
  }

  function moveExpense(id, direction) {
    const currentIndex = expenses.findIndex((expense) => expense.id === id);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= expenses.length) {
      return;
    }

    const nextExpenses = [...expenses];
    [nextExpenses[currentIndex], nextExpenses[nextIndex]] = [nextExpenses[nextIndex], nextExpenses[currentIndex]];
    persistExpenses(nextExpenses);
  }

  function clearMonth() {
    setConfirmation({ type: "clear" });
  }

  async function confirmDestructiveAction() {
    setDestructiveLoading(true);
    try {
      if (confirmation?.type === "delete" && confirmation.deleteSeries && confirmation.expense) {
        const removed = await deleteExpenseSeries(confirmation.expense);
        notify({ status: "info", title: "Dívida completa excluída", description: `${removed} lançamento(s) relacionado(s) foram removidos.` });
      } else if (confirmation?.type === "delete") {
        await persistExpenses(expenses.filter((expense) => expense.id !== confirmation.id));
        notify({ status: "info", title: "Despesa excluída somente deste mês" });
      } else if (confirmation?.type === "clear") {
        await persistExpenses([]);
        notify({ status: "info", title: "Mês limpo", description: `${monthLabel} ficou sem despesas.` });
      }
      setConfirmation(null);
    } catch (error) {
      notify({ status: "error", title: "Não foi possível excluir", description: error.message });
    } finally {
      setDestructiveLoading(false);
    }
  }

  async function deleteExpenseSeries(referenceExpense) {
    const loadedMonths = user.legacy ? getAllLocalFinanceMonths(user.email) : await loadAllFinanceMonths(user);
    const monthsByPeriod = new Map(loadedMonths.map((entry) => [`${entry.year}-${entry.month}`, entry]));
    monthsByPeriod.set(`${selected.year}-${selected.month}`, { year: selected.year, month: selected.month, salary, expenses });
    let removedCount = 0;

    for (const monthData of monthsByPeriod.values()) {
      const nextExpenses = monthData.expenses.filter((candidate) => {
        const matches = isExpenseInSeries(candidate, referenceExpense);
        if (matches) removedCount += 1;
        return !matches;
      });
      if (nextExpenses.length === monthData.expenses.length) continue;

      saveExpenses(user.email, monthData.year, monthData.month, nextExpenses);
      if (!user.legacy) await saveFinanceMonth(user.id, monthData.year, monthData.month, monthData.salary, nextExpenses);
      if (monthData.year === selected.year && monthData.month === selected.month) {
        expensesRef.current = nextExpenses;
        setExpenses(nextExpenses);
      }
    }

    return removedCount;
  }

  async function repairStalledInstallments() {
    const months = user.legacy ? getAllLocalFinanceMonths(user.email) : await loadAllFinanceMonths(user);
    const groups = new Map();

    months.forEach((monthData) => {
      monthData.expenses.forEach((expense) => {
        const progress = parseInstallmentLabel(expense.installment);
        if (!progress) return;
        const identity = expense.seriesId
          ? `series:${expense.seriesId}`
          : `legacy:${getInstallmentSeriesIdentity(expense)}`;
        if (!identity || identity === "legacy:") return;
        const entries = groups.get(identity) || [];
        entries.push({ monthData, expense, progress });
        groups.set(identity, entries);
      });
    });

    const changesByPeriod = new Map();
    for (const entries of groups.values()) {
      if (entries.length < 2) continue;
      entries.sort((a, b) => a.monthData.year - b.monthData.year || a.monthData.month - b.monthData.month);
      const totals = new Set(entries.map((entry) => entry.progress.total));
      const currents = new Set(entries.map((entry) => entry.progress.current));
      if (totals.size !== 1 || currents.size !== 1) continue;

      const first = entries[0];
      if (first.progress.current >= first.progress.total) continue;
      entries.forEach((entry) => {
        const offset = (entry.monthData.year - first.monthData.year) * 12 + entry.monthData.month - first.monthData.month;
        const expected = first.progress.current + offset;
        const period = `${entry.monthData.year}-${entry.monthData.month}`;
        const change = changesByPeriod.get(period) || { monthData: entry.monthData, updates: new Map(), removals: new Set() };
        if (expected > first.progress.total) change.removals.add(String(entry.expense.id));
        else if (expected !== entry.progress.current) change.updates.set(String(entry.expense.id), `${expected}/${first.progress.total}`);
        changesByPeriod.set(period, change);
      });
    }

    for (const change of changesByPeriod.values()) {
      const nextExpenses = change.monthData.expenses
        .filter((expense) => !change.removals.has(String(expense.id)))
        .map((expense) => change.updates.has(String(expense.id))
          ? { ...expense, installment: change.updates.get(String(expense.id)) }
          : expense);
      saveExpenses(user.email, change.monthData.year, change.monthData.month, nextExpenses);
      if (!user.legacy) await saveFinanceMonth(user.id, change.monthData.year, change.monthData.month, change.monthData.salary, nextExpenses);
      if (change.monthData.year === selected.year && change.monthData.month === selected.month) {
        expensesRef.current = nextExpenses;
        setExpenses(nextExpenses);
      }
    }
  }

  async function copyToNextMonth() {
    if (expenses.length === 0) {
      notify({ status: "warning", title: "Nada para copiar" });
      return;
    }

    const next = getNextMonth(selected.year, selected.month);
    const nextMonthData = user.legacy
      ? { salary: getSalary(user.email, next.year, next.month), expenses: getExpenses(user.email, next.year, next.month) }
      : await loadFinanceMonth(user, next.year, next.month);
    const nextExpenses = nextMonthData.expenses;
    const nextMonthLabel = formatMonthYear(next.year, next.month);
    const copied = expenses
      .filter((expense) => !nextExpenses.some((nextExpense) => isSameCopiedExpense(expense, nextExpense)))
      .map((expense, index) => ({
        ...expense,
        id: Date.now() + index,
        status: "aguardando",
        installment: getNextInstallment(expense.installment),
      }));

    if (copied.length === 0) {
      notify({
        status: "info",
        title: "Nada novo para copiar",
        description: `${nextMonthLabel} já possui todas as despesas de ${monthLabel}.`,
      });
      return;
    }

    saveExpenses(user.email, next.year, next.month, [...nextExpenses, ...copied]);
    const nextSalary = nextMonthData.salary || salary;
    saveSalary(user.email, next.year, next.month, nextSalary);
    if (!user.legacy) await saveFinanceMonth(user.id, next.year, next.month, nextSalary, [...nextExpenses, ...copied]);

    notify({
      status: "success",
      title: "Copiado para o próximo mês",
      description: `${copied.length} despesa(s) faltante(s) de ${monthLabel} foram adicionadas em ${nextMonthLabel}.`,
    });
  }

  function updateBulkRow(index, patch) {
    setBulkRows(bulkRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    clearImportPreview();
  }

  function addBulkRow() {
    setBulkRows([...bulkRows, { ...emptyBulkRow }]);
  }

  function removeBulkRow(index) {
    setBulkRows(bulkRows.filter((_, rowIndex) => rowIndex !== index));
    clearImportPreview();
  }

  function previewBulkRows() {
    const drafts = bulkRows
      .filter((row) => Object.values(row).some((value) => String(value || "").trim()))
      .map((row) => normalizeImportedDraft(row, selected));

    if (drafts.length === 0) {
      notify({ status: "warning", title: "Nada para importar", description: "Preencha ao menos uma linha." });
      return;
    }

    showPreview("Prévia das despesas em massa", drafts);
  }

  function getExpenseStatusView(expense) {
    if (expense.status === "pago") {
      return { label: "Pago", ...paidStatus };
    }

    const hasDueDate = expense.dueDate !== "";
    const isPastMonth = selected.year < currentYear || (selected.year === currentYear && selected.month < currentMonth);
    const isCurrentMonth = selected.year === currentYear && selected.month === currentMonth;
    const isOverdue =
      expense.status === "atrasado" || (hasDueDate && expense.status !== "pago" && (isPastMonth || (isCurrentMonth && Number(expense.dueDate) < today)));

    if (isOverdue) {
      return { label: "Atrasado", ...overdueStatus };
    }

    return { label: "Não pago", ...unpaidStatus };
  }

  function renderExpenseCell(expense, columnKey, statusView) {
    if (columnKey === "category") {
      return <Td>{getCanonicalCategory(expense.category) || "—"}</Td>;
    }

    if (columnKey === "value") {
      return <Td isNumeric>{formatMoney(expense.value)}</Td>;
    }

    if (columnKey === "debtBalance") {
      return <Td isNumeric>{expense.debtBalance ? formatMoney(expense.debtBalance) : "—"}</Td>;
    }

    if (columnKey === "dueDate") {
      return <Td>{expense.dueDate ? `Dia ${expense.dueDate}` : "—"}</Td>;
    }

    if (columnKey === "installment") {
      return <Td textAlign="center">{expense.installment || "—"}</Td>;
    }

    if (columnKey === "note") {
      return (
        <Td maxW="240px" whiteSpace="normal">
          {expense.note || "—"}
        </Td>
      );
    }

    if (columnKey === "status") {
      return (
        <Td minW="150px">
          <Select
            size="sm"
            value={statusView.label === "Atrasado" ? "atrasado" : expense.status || "aguardando"}
            variant="outline"
            bg={statusView.bg}
            color={statusView.color}
            iconColor={statusView.color}
            fontWeight="600"
            borderColor={statusView.border}
            borderRadius="full"
            _hover={{ borderColor: statusView.color }}
            _focusVisible={{ borderColor: statusView.color, boxShadow: `0 0 0 1px var(--chakra-colors-${colorMode === "dark" ? "whiteAlpha-400" : "gray-300"})` }}
            sx={{ option: { background: colorMode === "dark" ? "#1A202C" : "white", color: colorMode === "dark" ? "white" : "#1A202C", fontWeight: 400 } }}
            onChange={(event) => updateStatus(expense.id, event.target.value)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Td>
      );
    }

    return null;
  }

  const welcomePanel = (
    <HeroCard h="100%" p={{ base: 4, md: 5 }}>
      <Stack spacing={4}>
        <Stack spacing={3} align="center" textAlign="center" minW={0}>
          <HStack flexWrap="wrap" justify="center">
              <Badge colorScheme="brand" borderRadius="full" px={3} py={1}>
                Dashboard financeiro
              </Badge>
              <Badge colorScheme={urgency.colorScheme} borderRadius="full" px={3} py={1}>
                {urgency.label}
              </Badge>
          </HStack>
          <Heading size={{ base: "md", md: "lg" }} overflowWrap="anywhere">Bem-vindo, {user.username || user.email}</Heading>
          <Text color={mutedText} fontSize="sm">{timeLabel}</Text>
          <Box
            minH="40px"
            maxW="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            px={4}
            py={2}
            bg={userDisplayBg}
            border="1px solid"
            borderColor={userDisplayBorder}
            borderRadius="full"
            fontWeight="600"
            textAlign="center"
            overflowWrap="anywhere"
          >
            {user.username || user.email}
          </Box>
          <HStack flexWrap="wrap" justify="center" spacing={2}>
            <IconButton
              aria-label="Sair"
              icon={<PowerIcon />}
              bg={logoutBg}
              border="1px solid"
              borderColor={logoutBorder}
              color={logoutColor}
              _hover={{ bg: colorMode === "light" ? "rose.100" : "rgba(159, 18, 57, 0.4)" }}
              onClick={onLogout}
            />
            <IconButton
              aria-label={user.legacy ? "Confirmar atualização" : "Alterar senha"}
              icon={<EditIcon />}
              colorScheme="brand"
              variant="outline"
              onClick={user.legacy ? legacyModal.onOpen : profileModal.onOpen}
            />
            {user.role === "admin" ? (
              <IconButton
                aria-label="Abrir área administrativa"
                icon={<SettingsIcon />}
                colorScheme="lavender"
                variant="outline"
                onClick={adminModal.onOpen}
              />
            ) : null}
            <IconButton
              aria-label="Alternar tema"
              icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
              variant="outline"
              onClick={toggleColorMode}
            />
          </HStack>
        </Stack>

        <SimpleGrid columns={{ base: 2, xl: 1 }} spacing={2}>
          <SummaryCard label="Salário" value={formatMoney(salary)} help={monthLabel} colorScheme="mint" />
          <SummaryCard label="Gastos" value={formatMoney(summary.total)} help={`${expenses.length} despesa(s)`} colorScheme="peach" />
          <SummaryCard
            label="Saldo previsto"
            value={formatMoney(summary.balance)}
            help={`Dia ${formatMoney(summary.dailyBalance)}`}
            colorScheme={summary.balance >= 0 ? "sky" : "rose"}
          />
          <SummaryCard
            label="Despesas em aberto"
            value={formatMoney(unpaidTotal)}
            help={`Em aberto em ${monthLabel}`}
            colorScheme="lavender"
          />
        </SimpleGrid>
      </Stack>
    </HeroCard>
  );

  const monthPanel = (
    <HeroCard h="100%" p={{ base: 4, md: 5 }}>
      <Stack spacing={5} align="stretch">
        <Stack spacing={1}>
          <Text fontWeight="800">Pasta do mês</Text>
          <Text color={softText}>{monthLabel}</Text>
        </Stack>

        <HStack justify="space-between" align="center" spacing={3}>
          <Button size="sm" variant="outline" colorScheme="brand" onClick={copyToNextMonth} flex="1" minW={0}>
            Copiar para próximo mês
          </Button>
          <Box fontSize="2xl" lineHeight="1" flexShrink={0}>
            📁
          </Box>
        </HStack>

        <Stack spacing={4}>
          <FormControl>
            <FormLabel fontSize="sm">Ano</FormLabel>
            <Select value={selected.year} onChange={(event) => setSelected({ ...selected, year: Number(event.target.value) })}>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Salário mensal</FormLabel>
            <NumberInput value={salary} min={0} onChange={(_, value) => persistSalary(Number.isNaN(value) ? 0 : value)}>
              <NumberInputField placeholder="3000" />
            </NumberInput>
          </FormControl>
        </Stack>

        <SimpleGrid columns={3} spacing={2} bg={subtleBg} borderRadius="20px" p={2}>
          {MONTHS.map((month, index) => (
            <Button
              key={month}
              size="sm"
              minW={0}
              px={2}
              colorScheme={selected.month === index + 1 ? "brand" : "gray"}
              variant={selected.month === index + 1 ? "solid" : "outline"}
              onClick={() => setSelected({ ...selected, month: index + 1 })}
            >
              {month}
            </Button>
          ))}
        </SimpleGrid>
      </Stack>
    </HeroCard>
  );

  return (
    <Box minH="100vh" py={{ base: 3, md: 5 }} display="flex" flexDirection="column">
      <Container maxW="1760px" flex="1" w="100%">
        {user.legacy || legacySummary ? (
          <HeroCard mb={4} p={{ base: 4, md: 5 }} borderColor="mint.300">
            <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
              <Box>
                <Heading size="sm">Atualizamos o White Cat</Heading>
                <Text color={mutedText} fontSize="sm">
                  {user.legacy
                    ? "O app foi atualizado. Confirme seu acesso para usar o White Cat em qualquer lugar e dispositivo."
                    : `Encontramos ${legacySummary.months} mês(es) salvo(s) neste navegador. Confirme seus dados antigos para preservar as planilhas.`}
                </Text>
              </Box>
              <Button colorScheme="mint" onClick={legacyModal.onOpen}>{user.legacy ? "Continuar atualização" : "Salvar minhas planilhas"}</Button>
            </HStack>
          </HeroCard>
        ) : null}
        <Grid
          templateColumns={{ base: "1fr", xl: "minmax(230px, 300px) minmax(0, 1fr) minmax(230px, 300px)" }}
          gap={4}
          alignItems="start"
        >
          <Stack spacing={4}>{welcomePanel}</Stack>

          <HeroCard p={{ base: 4, md: 5 }}>
              <Stack spacing={4}>
                <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                  <Box>
                    <Heading size="md">Despesas</Heading>
                    <Text color="gray.500">{monthLabel}</Text>
                  </Box>
                  <HStack flexWrap="wrap">
                    <Menu closeOnSelect={false}>
                      <MenuButton as={Button} size="sm" variant="outline" colorScheme="brand" leftIcon={<SettingsIcon />}>
                        Colunas
                      </MenuButton>
                      <MenuList>
                        {expenseColumns.map((column) => (
                          <MenuItem
                            key={column.key}
                            icon={visibleExpenseColumns.includes(column.key) ? <CheckIcon /> : undefined}
                            onClick={() => toggleExpenseColumn(column.key)}
                          >
                            {column.label}
                          </MenuItem>
                        ))}
                      </MenuList>
                    </Menu>
                    <Select size="sm" w={{ base: "100%", sm: "180px" }} value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                      <option value="dueDate">Ordenar: vencimento</option>
                      <option value="name">Ordenar: A-Z</option>
                      <option value="valueDesc">Ordenar: maior valor</option>
                      <option value="valueAsc">Ordenar: menor valor</option>
                      <option value="status">Ordenar: status</option>
                      <option value="category">Ordenar: categoria</option>
                      <option value="manual">Ordenar: manual</option>
                    </Select>
                    <Select
                      size="sm"
                      w={{ base: "100%", sm: "210px" }}
                      placeholder="Mudar todos os status"
                      onChange={(event) => {
                        if (event.target.value) {
                          updateAllStatuses(event.target.value);
                          event.target.value = "";
                        }
                      }}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          Marcar tudo como {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </Select>
                    <Button size="sm" leftIcon={<AddIcon />} colorScheme="mint" onClick={openNewExpense}>
                      Adicionar nova despesa
                    </Button>
                    <Button size="sm" colorScheme="rose" variant="outline" onClick={clearMonth}>
                      Limpar mês
                    </Button>
                  </HStack>
                </HStack>
                <Stack display={{ base: "flex", md: "none" }} spacing={2}>
                  {sortedExpenses.map((expense) => {
                    const statusView = getExpenseStatusView(expense);

                    return (
                      <Box
                        key={expense.id}
                        bg={mobileItemBg}
                        border="1px solid"
                        borderColor={mobileItemBorder}
                        borderRadius="16px"
                        px={3}
                        py={3}
                        onClick={() => editExpense(expense)}
                      >
                        <HStack justify="space-between" align="center" gap={3}>
                          <Box minW={0} flex="1">
                            <Text fontWeight="800" noOfLines={1}>
                              {getDisplayExpenseName(expense)}
                            </Text>
                            <Badge bg={statusView.bg} color={statusView.color} borderRadius="full" px={2} mt={1}>
                              {statusView.label}
                            </Badge>
                          </Box>
                          <Text fontWeight="900" color={statusView.color} whiteSpace="nowrap">
                            {formatMoney(expense.value)}
                          </Text>
                        </HStack>
                      </Box>
                    );
                  })}
                </Stack>

                <TableContainer display={{ base: "none", md: "block" }}>
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Despesa</Th>
                        {expenseColumns
                          .filter((column) => visibleExpenseColumns.includes(column.key))
                          .map((column) => (
                            <Th key={column.key} isNumeric={column.numeric} textAlign={column.key === "installment" ? "center" : undefined}>
                              {column.label}
                            </Th>
                          ))}
                        <Th textAlign="center">Ações</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {sortedExpenses.map((expense) => {
                        const statusView = getExpenseStatusView(expense);

                        return (
                          <Tr key={expense.id}>
                            <Td fontWeight="700" minW="130px">
                              {getDisplayExpenseName(expense)}
                            </Td>
                            {expenseColumns
                              .filter((column) => visibleExpenseColumns.includes(column.key))
                              .map((column) => (
                                <Fragment key={column.key}>{renderExpenseCell(expense, column.key, statusView)}</Fragment>
                              ))}
                            <Td textAlign="center">
                              <HStack justify="center" spacing={1}>
                                <IconButton
                                  aria-label="Subir"
                                  icon={<ChevronUpIcon />}
                                  size="sm"
                                  variant="ghost"
                                  isDisabled={sortMode !== "manual" || expenses.findIndex((item) => item.id === expense.id) === 0}
                                  onClick={() => moveExpense(expense.id, -1)}
                                />
                                <IconButton
                                  aria-label="Descer"
                                  icon={<ChevronDownIcon />}
                                  size="sm"
                                  variant="ghost"
                                  isDisabled={
                                    sortMode !== "manual" || expenses.findIndex((item) => item.id === expense.id) === expenses.length - 1
                                  }
                                  onClick={() => moveExpense(expense.id, 1)}
                                />
                                <IconButton aria-label="Editar" icon={<EditIcon />} size="sm" variant="ghost" onClick={() => editExpense(expense)} />
                                <IconButton
                                  aria-label="Excluir"
                                  icon={<DeleteIcon />}
                                  size="sm"
                                  colorScheme="rose"
                                  variant="ghost"
                                  onClick={() => deleteExpense(expense.id)}
                                />
                              </HStack>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Stack>
            </HeroCard>

          <Stack spacing={4}>{monthPanel}</Stack>
        </Grid>
      </Container>

      <Box as="footer" textAlign="center" color={softText} fontSize="sm" pt={4} pb={1} px={4}>
        Desenvolvido por{" "}
        <Box
          as="a"
          href="https://ds-devforge.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          color="brand.500"
          fontWeight="800"
        >
          DS Devforge
        </Box>
        , com carinho.
      </Box>

      <Modal isOpen={expenseModal.isOpen} onClose={expenseModal.onClose} isCentered size="6xl">
        <ModalOverlay />
        <ModalContent borderRadius="24px">
          <ModalHeader>{editingId ? "Editar despesa" : "Adicionar despesa"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Tabs colorScheme="brand" index={expenseTab} onChange={(index) => { setExpenseTab(index); clearImportPreview(); }}>
              <TabList flexWrap="wrap">
                <Tab>Individual</Tab>
                <Tab>Várias despesas</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0}>
                  <Stack as="form" id="expense-form" spacing={4} onSubmit={handleSubmit}>
                    <FormControl>
                      <FormLabel>Descrição</FormLabel>
                      <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Categoria</FormLabel>
                      <Select
                        value={form.category}
                        placeholder="Selecione uma categoria"
                        onChange={(event) => setForm({ ...form, category: event.target.value })}
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                        {form.category && !CATEGORIES.includes(form.category) ? <option value={form.category}>{form.category}</option> : null}
                      </Select>
                    </FormControl>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      <FormControl>
                        <FormLabel>Valor</FormLabel>
                        <Input value={form.value} placeholder="160,50" onChange={(event) => setForm({ ...form, value: event.target.value })} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Dívida total</FormLabel>
                        <Input
                          value={form.debtBalance}
                          placeholder="1200"
                          onChange={(event) => setForm({ ...form, debtBalance: event.target.value })}
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Vencimento</FormLabel>
                        <Input value={form.dueDate} placeholder="Dia 10 ou 10/07/2026" onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                      </FormControl>
                    </SimpleGrid>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <FormControl>
                        <FormLabel>Parcela</FormLabel>
                        <Input placeholder="12 ou 5/12" value={form.installment} onChange={(event) => setForm({ ...form, installment: event.target.value })} />
                        <Text color={softText} fontSize="xs" mt={1}>Se algumas parcelas já foram pagas, informe a atual. Exemplo: 5/12.</Text>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Status</FormLabel>
                        <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                    </SimpleGrid>
                    <Stack spacing={3} bg={subtleBg} borderRadius="18px" p={4}>
                      <Checkbox isChecked={repeatMonthly} onChange={(event) => setRepeatMonthly(event.target.checked)}>
                        Repetir todo mês
                      </Checkbox>
                      {repeatMonthly ? (
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                          <FormControl>
                            <FormLabel>Quantidade de meses</FormLabel>
                            <NumberInput value={repeatMonths} min={1} max={60} isDisabled={repeatFixed} onChange={(_, value) => setRepeatMonths(Number.isNaN(value) ? 1 : value)}>
                              <NumberInputField />
                            </NumberInput>
                          </FormControl>
                          <FormControl display="flex" alignItems="end">
                            <Checkbox isChecked={repeatFixed} onChange={(event) => setRepeatFixed(event.target.checked)}>
                              Recorrente fixa ({FIXED_RECURRENCE_MONTHS} meses)
                            </Checkbox>
                          </FormControl>
                        </SimpleGrid>
                      ) : null}
                    </Stack>
                    <FormControl>
                      <FormLabel>Observação</FormLabel>
                      <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
                    </FormControl>
                  </Stack>
                </TabPanel>
                <TabPanel px={0}>
                  <Stack spacing={4}>
                    <TableContainer>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Descrição</Th>
                            <Th>Categoria</Th>
                            <Th>Valor</Th>
                            <Th>Vencimento</Th>
                            <Th>Status</Th>
                            <Th>Observação</Th>
                            <Th />
                          </Tr>
                        </Thead>
                        <Tbody>
                          {bulkRows.map((row, index) => (
                            <Tr key={index}>
                              <Td><Input size="sm" value={row.name} onChange={(event) => updateBulkRow(index, { name: event.target.value })} /></Td>
                              <Td>
                                <Select
                                  size="sm"
                                  value={row.category}
                                  placeholder="Categoria"
                                  onChange={(event) => updateBulkRow(index, { category: event.target.value })}
                                >
                                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                                </Select>
                              </Td>
                              <Td><Input size="sm" value={row.value} onChange={(event) => updateBulkRow(index, { value: event.target.value })} /></Td>
                              <Td><Input size="sm" value={row.dueDate} onChange={(event) => updateBulkRow(index, { dueDate: event.target.value })} /></Td>
                              <Td>
                                <Select size="sm" value={row.status} onChange={(event) => updateBulkRow(index, { status: event.target.value })}>
                                  {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                                </Select>
                              </Td>
                              <Td><Input size="sm" value={row.note} onChange={(event) => updateBulkRow(index, { note: event.target.value })} /></Td>
                              <Td><IconButton aria-label="Remover linha" icon={<DeleteIcon />} size="sm" variant="ghost" onClick={() => removeBulkRow(index)} /></Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                    <HStack>
                      <Button size="sm" variant="outline" onClick={addBulkRow}>Adicionar linha</Button>
                      <Button size="sm" colorScheme="brand" onClick={previewBulkRows}>Gerar prévia</Button>
                    </HStack>
                    <ImportPreview title={previewTitle} drafts={importPreview} />
                  </Stack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={expenseModal.onClose}>
              Cancelar
            </Button>
            {expenseTab === 0 ? (
              <Button type="submit" form="expense-form" leftIcon={<AddIcon />} colorScheme="mint">
                {editingId ? "Salvar edição" : "Adicionar"}
              </Button>
            ) : (
              <Button colorScheme="mint" isDisabled={importPreview.length === 0} onClick={confirmPreview}>
                Confirmar prévia
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={profileModal.isOpen} onClose={profileModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="24px">
          <ModalHeader>Alterar senha</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack as="form" id="profile-form" spacing={4} onSubmit={handleProfileSubmit}>
              <FormControl isRequired>
                <FormLabel>Nova senha</FormLabel>
                <Input
                  type="password"
                  minLength={6}
                  placeholder="Pelo menos 6 caracteres"
                  value={profileForm.password}
                  onChange={(event) => setProfileForm({ ...profileForm, password: event.target.value })}
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={profileModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="profile-form" colorScheme="brand">
              Salvar nova senha
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={legacyModal.isOpen}
        onClose={legacyModal.onClose}
        isCentered
        closeOnOverlayClick={false}
        closeOnEsc={false}
      >
        <ModalOverlay />
        <ModalContent borderRadius="24px">
          <ModalHeader>Atualizamos nosso app</ModalHeader>
          <ModalBody>
            <Stack
              as="form"
              id="legacy-migration-form"
              spacing={4}
              onSubmit={user.legacy ? upgradeLegacyAccount : handleLegacyMigration}
            >
              <Box bg={subtleBg} borderRadius="18px" p={4}>
                <Text fontWeight="700" mb={1}>O White Cat foi atualizado!</Text>
                <Text color={mutedText} fontSize="sm">
                  Agora você pode acessar sua planilha de qualquer lugar e em qualquer dispositivo usando seu usuário e senha. Para continuar, entre novamente com os dados que já utiliza.
                </Text>
              </Box>
              <FormControl isRequired>
                <FormLabel>Usuário</FormLabel>
                <Input autoFocus value={legacyForm.username} onChange={(event) => setLegacyForm({ ...legacyForm, username: event.target.value })} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Senha</FormLabel>
                <InputGroup>
                  <Input
                    type={showLegacyPassword ? "text" : "password"}
                    value={legacyForm.password}
                    onChange={(event) => setLegacyForm({ ...legacyForm, password: event.target.value })}
                    pr="3rem"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={showLegacyPassword ? "Ocultar senha" : "Mostrar senha salva"}
                      icon={showLegacyPassword ? <ViewOffIcon /> : <ViewIcon />}
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => setShowLegacyPassword((current) => !current)}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={legacyModal.onClose} isDisabled={migratingLegacy}>Cancelar</Button>
            <Button type="submit" form="legacy-migration-form" colorScheme="mint" isLoading={migratingLegacy}>
              Salvar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={migrationSuccessModal.isOpen} onClose={migrationSuccessModal.onClose} isCentered closeOnOverlayClick={false} closeOnEsc={false}>
        <ModalOverlay />
        <ModalContent borderRadius="24px" textAlign="center">
          <ModalBody py={8}>
            <Text fontSize="5xl" mb={3}>🎉</Text>
            <Heading size="lg" mb={3}>PRONTO!</Heading>
            <Text color={mutedText} fontSize="lg">Sua planilha White Cat está com você em todo lugar agora!</Text>
          </ModalBody>
          <ModalFooter justifyContent="center" pt={0} pb={6}>
            <Button colorScheme="mint" minW="140px" onClick={migrationSuccessModal.onClose}>OK</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {user.role === "admin" ? <AdminDashboard isOpen={adminModal.isOpen} onClose={adminModal.onClose} /> : null}

      <AlertDialog
        isOpen={Boolean(confirmation)}
        leastDestructiveRef={cancelConfirmationRef}
        onClose={() => setConfirmation(null)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="24px">
            <AlertDialogHeader fontSize="lg" fontWeight="800">
              {confirmation?.type === "clear"
                ? "Limpar todas as despesas do mês?"
                : confirmation?.deleteSeries
                  ? "Excluir a dívida completa?"
                  : "Excluir esta despesa?"}
            </AlertDialogHeader>
            <AlertDialogBody>
              <Stack spacing={4}>
                <Text>
                  {confirmation?.type === "clear"
                    ? `Todas as despesas de ${monthLabel} serão removidas. Esta ação não pode ser desfeita.`
                    : confirmation?.deleteSeries
                      ? `Todas as parcelas ou recorrências relacionadas a “${confirmation?.name || "Despesa"}” serão removidas de todos os meses.`
                      : `“${confirmation?.name || "Despesa"}” será removida somente de ${monthLabel}.`}
                </Text>
                {confirmation?.type === "delete" && confirmation.hasSeries ? (
                  <Checkbox
                    colorScheme="rose"
                    isChecked={confirmation.deleteSeries}
                    onChange={(event) => setConfirmation((current) => ({ ...current, deleteSeries: event.target.checked }))}
                  >
                    Excluir dívida completa de todos os meses
                  </Checkbox>
                ) : null}
                <Text color={softText} fontSize="sm">Esta ação não pode ser desfeita.</Text>
              </Stack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelConfirmationRef} onClick={() => setConfirmation(null)}>
                Cancelar
              </Button>
              <Button colorScheme="rose" onClick={confirmDestructiveAction} ml={3} isLoading={destructiveLoading}>
                {confirmation?.type === "clear" ? "Limpar mês" : confirmation?.deleteSeries ? "Excluir tudo" : "Excluir deste mês"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

function isSeriesExpense(expense) {
  if (!expense) return false;
  return Boolean(
    String(expense.seriesId || "").trim()
    || getInstallmentSeriesIdentity(expense)
    || getRecurringSeriesIdentity(expense),
  );
}

function getAccountUpgradeErrorMessage(error) {
  if (String(error?.message || "").toLowerCase().includes("email signups are disabled")) {
    return "No Supabase, habilite o provedor Email e novos cadastros, mas deixe Confirm email desativado. O White Cat continuará pedindo somente usuário e senha.";
  }
  return error?.message || "Não foi possível criar a conta online.";
}

function isExpenseInSeries(candidate, reference) {
  const referenceSeriesId = String(reference?.seriesId || "").trim();
  if (referenceSeriesId) return String(candidate?.seriesId || "").trim() === referenceSeriesId;

  const installmentIdentity = getInstallmentSeriesIdentity(reference);
  if (installmentIdentity) return getInstallmentSeriesIdentity(candidate) === installmentIdentity;

  const recurringIdentity = getRecurringSeriesIdentity(reference);
  return Boolean(recurringIdentity && getRecurringSeriesIdentity(candidate) === recurringIdentity);
}

function isSameCopiedExpense(source, target) {
  if (getExpenseIdentity(source) === getExpenseIdentity(target)) {
    return true;
  }

  const sourceSeries = getInstallmentSeriesIdentity(source);
  const targetSeries = getInstallmentSeriesIdentity(target);
  return Boolean(sourceSeries && targetSeries && sourceSeries === targetSeries);
}

function getNextInstallment(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);

  if (!match) {
    return text;
  }

  const current = Number(match[1]);
  const total = Number(match[2]);
  return current < total ? `${current + 1}/${total}` : text;
}

function getDisplayExpenseName(expense) {
  const name = String(expense.name || "").trim();
  const installment = String(expense.installment || "").trim();

  if (!installment) {
    return name;
  }

  return name.replace(new RegExp(`\\s+${escapeRegExp(installment)}$`), "");
}

function getExpenseIdentity(expense) {
  return [
    normalizeIdentityText(expense.name),
    normalizeIdentityText(expense.category || "Outros"),
    toMoneyCents(expense.value),
    Number(expense.dueDate || 0),
    normalizeIdentityText(expense.installment),
  ].join("|");
}

function getInstallmentSeriesIdentity(expense) {
  const installment = String(expense.installment || "").trim();
  const installmentMatch = installment.match(/^(\d+)\s*\/\s*(\d+)$/);
  const nameMatch = String(expense.name || "").trim().match(/^(.*?)\s+\d+\s*\/\s*(\d+)$/);
  const total = installmentMatch?.[2] || nameMatch?.[2];

  if (!total) {
    return "";
  }

  const baseName = nameMatch?.[1] || expense.name;
  return [
    normalizeIdentityText(baseName),
    normalizeIdentityText(expense.category || "Outros"),
    toMoneyCents(expense.value),
    Number(expense.dueDate || 0),
    total,
  ].join("|");
}

function parseInstallmentLabel(value) {
  const match = String(value || "").trim().match(/^(\d+)\s*(?:\/|de)\s*(\d+)$/i);
  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(current) || !Number.isInteger(total) || current < 1 || total < 2 || current > total) {
    return null;
  }

  return { current, total };
}

function normalizeIdentityText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function toMoneyCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRecurringSeriesIdentity(expense) {
  if (!normalizeIdentityText(expense?.note).includes("recorrente")) return "";
  return [
    normalizeIdentityText(expense?.name),
    normalizeIdentityText(expense?.category || "Outros"),
    toMoneyCents(expense?.value),
    Number(expense?.dueDate || 0),
  ].join("|");
}

function PowerIcon(props) {
  return (
    <Icon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M12 2v10" />
      <path d="M6.34 4.93a8 8 0 1 0 11.32 0" />
    </Icon>
  );
}

function SummaryCard({ label, value, help, colorScheme = "brand" }) {
  const colorMap = {
    brand: { bg: "brand.50", border: "brand.100", text: "brand.700" },
    mint: { bg: "mint.50", border: "mint.100", text: "mint.700" },
    peach: { bg: "peach.50", border: "peach.100", text: "peach.700" },
    rose: { bg: "rose.50", border: "rose.100", text: "rose.700" },
    sky: { bg: "sky.50", border: "sky.100", text: "sky.700" },
    lavender: { bg: "lavender.50", border: "lavender.100", text: "lavender.700" },
  };
  const colors = colorMap[colorScheme] || colorMap.brand;
  const bg = useColorModeValue(colors.bg, "whiteAlpha.100");
  const borderColor = useColorModeValue(colors.border, "whiteAlpha.200");
  const textColor = useColorModeValue(colors.text, `${colorScheme}.200`);

  return (
    <Box bg={bg} border="1px solid" borderColor={borderColor} borderRadius="16px" px={3} py={2}>
      <Stat>
        <StatLabel color="gray.500" fontSize="xs" lineHeight="1.1">
          {label}
        </StatLabel>
        <StatNumber color={textColor} fontSize={{ base: "md", md: "lg" }} lineHeight="1.2">
          {value}
        </StatNumber>
        <StatHelpText mb={0} fontSize="xs" lineHeight="1.1">
          {help}
        </StatHelpText>
      </Stat>
    </Box>
  );
}

function ImportPreview({ drafts, title }) {
  if (!drafts.length) {
    return null;
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Text fontWeight="800">{title}</Text>
        <Text color="gray.500" fontSize="sm">
          {drafts.length} lançamento(s) aguardando confirmação.
        </Text>
      </Box>
      <TableContainer maxH="280px" overflowY="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Descrição</Th>
              <Th isNumeric>Valor</Th>
              <Th>Vencimento</Th>
              <Th>Status</Th>
              <Th>Erros</Th>
            </Tr>
          </Thead>
          <Tbody>
            {drafts.map((draft) => (
              <Tr key={draft.previewId ?? `${draft.name}-${draft.dueYear}-${draft.dueMonth}-${draft.dueDate}`}>
                <Td fontWeight="700">{draft.name || "—"}</Td>
                <Td isNumeric>{formatMoney(draft.value)}</Td>
                <Td>
                  {draft.dueDate ? `${String(draft.dueDate).padStart(2, "0")}/${String(draft.dueMonth).padStart(2, "0")}/${draft.dueYear}` : "—"}
                </Td>
                <Td>{STATUS_LABELS[draft.status] || draft.status}</Td>
                <Td color={draft.errors?.length ? "rose.300" : "mint.300"}>{draft.errors?.length ? draft.errors.join(", ") : "Ok"}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
