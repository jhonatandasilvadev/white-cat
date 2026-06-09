import {
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
  IconButton,
  Input,
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
import { AddIcon, CheckIcon, DeleteIcon, EditIcon, MoonIcon, SettingsIcon, SunIcon } from "@chakra-ui/icons";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { Fragment, useEffect, useMemo, useState } from "react";
import HeroCard from "./HeroCard.jsx";
import { notify } from "../toast.js";
import {
  calculateSummary,
  CATEGORIES,
  formatMoney,
  formatMonthYear,
  getBrasiliaDate,
  getCurrentTimeLabel,
  getNextMonth,
  MONTHS,
  sortExpenses,
  STATUSES,
  STATUS_LABELS,
} from "../lib/finance.js";
import { getExpenses, getSalary, getUsers, migrateFinanceKeys, saveExpenses, saveSalary, saveUsers, setLoggedUser } from "../lib/storage.js";
import { seedAprilIfNeeded } from "../lib/migrateLegacy.js";
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
  category: "Outros",
  value: "",
  dueDate: "",
  installment: "",
  status: "aguardando",
  debtBalance: "",
  note: "",
};

const emptyBulkRow = {
  name: "",
  category: "Outros",
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
  const [profileForm, setProfileForm] = useState({ email: user.email, password: user.password || "" });
  const expenseModal = useDisclosure();
  const profileModal = useDisclosure();

  const currentYear = brasiliaNow.getFullYear();
  const currentMonth = brasiliaNow.getMonth() + 1;
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  const monthLabel = formatMonthYear(selected.year, selected.month);

  useEffect(() => {
    const interval = window.setInterval(() => setTimeLabel(getCurrentTimeLabel()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selected.year === 2026 && selected.month === 4) {
      seedAprilIfNeeded(user.email);
    }
    setSalary(getSalary(user.email, selected.year, selected.month));
    setExpenses(getExpenses(user.email, selected.year, selected.month));
    setEditingId(null);
    setForm(emptyForm);
  }, [selected, user.email]);

  useEffect(() => {
    setProfileForm({ email: user.email, password: user.password || "" });
  }, [user]);

  const summary = useMemo(() => calculateSummary(salary, expenses), [salary, expenses]);
  const totalDebtBalance = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.debtBalance || 0), 0),
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

  function persistExpenses(nextExpenses) {
    setExpenses(nextExpenses);
    saveExpenses(user.email, selected.year, selected.month, nextExpenses);
  }

  function persistSalary(value) {
    setSalary(Number(value || 0));
    saveSalary(user.email, selected.year, selected.month, Number(value || 0));
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

  function saveDraftsAcrossMonths(drafts) {
    const groups = groupDraftsByMonth(drafts);
    let createdCount = 0;

    Object.values(groups).forEach((group) => {
      const currentGroup = group.year === selected.year && group.month === selected.month;
      const existingExpenses = currentGroup ? expenses : getExpenses(user.email, group.year, group.month);
      const createdExpenses = group.drafts.map((draft, index) => makeExpense(draft, Date.now() + createdCount + index));
      createdCount += createdExpenses.length;

      if (currentGroup) {
        persistExpenses([...existingExpenses, ...createdExpenses]);
      } else {
        saveExpenses(user.email, group.year, group.month, [...existingExpenses, ...createdExpenses]);
      }
    });

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

  function confirmPreview() {
    const errors = validateDraftsForSave(importPreview);
    if (errors.length > 0) {
      notify({ status: "warning", title: "Corrija antes de salvar", description: errors[0] });
      return;
    }

    const count = saveDraftsAcrossMonths(importPreview);
    clearImportPreview();
    setBulkRows([{ ...emptyBulkRow }, { ...emptyBulkRow }, { ...emptyBulkRow }]);
    expenseModal.onClose();
    notify({ status: "success", title: "Despesas adicionadas", description: `${count} despesa(s) salvas.` });
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    const nextEmail = profileForm.email.trim();
    const nextPassword = profileForm.password;

    if (!nextEmail || !nextPassword) {
      notify({ status: "warning", title: "Preencha os dados", description: "Usuário e senha são obrigatórios." });
      return;
    }

    const users = getUsers();
    const emailTaken = users.some((savedUser) => savedUser.email === nextEmail && savedUser.email !== user.email);

    if (emailTaken) {
      notify({ status: "warning", title: "Usuário já existe", description: "Escolha outro usuário para continuar." });
      return;
    }

    const nextUser = { email: nextEmail, password: nextPassword };
    const nextUsers = users.map((savedUser) => (savedUser.email === user.email ? nextUser : savedUser));

    if (!nextUsers.some((savedUser) => savedUser.email === nextEmail)) {
      nextUsers.push(nextUser);
    }

    migrateFinanceKeys(user.email, nextEmail);
    saveUsers(nextUsers);
    setLoggedUser(nextUser);
    onUserUpdate(nextUser);
    profileModal.onClose();
    notify({ status: "success", title: "Perfil atualizado", description: "Seu usuário e senha foram salvos." });
  }

  function handleSubmit(event) {
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

      persistExpenses(expenses.map((expense) => (expense.id === editingId ? editedExpense : expense)));
      if (repeatMonthly) {
        const count = saveDraftsAcrossMonths(recurringDrafts);
        notify({ status: "success", title: "Despesa atualizada", description: `${count + 1} lançamento(s) salvos.` });
      } else {
        notify({ status: "success", title: "Despesa atualizada" });
      }
    } else {
      const generatedDrafts =
        normalized.debtBalance && form.installment
          ? generateInstallmentDrafts(form, selected)
          : repeatMonthly
            ? generateRecurringDrafts(form, selected, { fixed: repeatFixed, months: repeatMonths })
            : [normalized];
      const generatedErrors = validateDraftsForSave(generatedDrafts);

      if (generatedErrors.length > 0) {
        notify({ status: "warning", title: "Revise a despesa", description: generatedErrors[0] });
        return;
      }

      const count = saveDraftsAcrossMonths(generatedDrafts);
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
      category: expense.category || "Outros",
      value: expense.value,
      dueDate: expense.dueDate,
      installment: expense.installment || "",
      status: expense.status || "aguardando",
      debtBalance: expense.debtBalance || "",
      note: expense.note || "",
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
    persistExpenses(expenses.filter((expense) => expense.id !== id));
    notify({ status: "info", title: "Despesa excluída" });
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
    persistExpenses([]);
    notify({ status: "info", title: "Mês limpo", description: `${monthLabel} ficou sem despesas.` });
  }

  function copyToNextMonth() {
    if (expenses.length === 0) {
      notify({ status: "warning", title: "Nada para copiar" });
      return;
    }

    const next = getNextMonth(selected.year, selected.month);
    const nextExpenses = getExpenses(user.email, next.year, next.month);
    const nextMonthLabel = formatMonthYear(next.year, next.month);
    const copied = expenses
      .filter((expense) => !nextExpenses.some((nextExpense) => isSameCopiedExpense(expense, nextExpense)))
      .map((expense, index) => ({ ...expense, id: Date.now() + index, status: "aguardando" }));

    if (copied.length === 0) {
      notify({
        status: "info",
        title: "Nada novo para copiar",
        description: `${nextMonthLabel} já possui todas as despesas de ${monthLabel}.`,
      });
      return;
    }

    saveExpenses(user.email, next.year, next.month, [...nextExpenses, ...copied]);

    if (!getSalary(user.email, next.year, next.month)) {
      saveSalary(user.email, next.year, next.month, salary);
    }

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
      return { label: "Pago", colorScheme: "mint", bg: "mint.100", color: "mint.800" };
    }

    const hasDueDate = expense.dueDate !== "";
    const isPastMonth = selected.year < currentYear || (selected.year === currentYear && selected.month < currentMonth);
    const isCurrentMonth = selected.year === currentYear && selected.month === currentMonth;
    const isOverdue =
      expense.status === "atrasado" || (hasDueDate && expense.status !== "pago" && (isPastMonth || (isCurrentMonth && Number(expense.dueDate) < today)));

    if (isOverdue) {
      return { label: "Atrasado", colorScheme: "rose", bg: "rose.100", color: "rose.800" };
    }

    if (expense.status === "aguardando" && hasDueDate) {
      return { label: "Em dia", colorScheme: "sky", bg: "sky.100", color: "sky.800" };
    }

    return { label: "Não pago", colorScheme: "peach", bg: "peach.100", color: "peach.900" };
  }

  function renderExpenseCell(expense, columnKey, statusView) {
    if (columnKey === "category") {
      return <Td>{expense.category || "—"}</Td>;
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
          <Stack spacing={1} align="stretch">
            <Badge alignSelf="flex-start" colorScheme={statusView.colorScheme} borderRadius="full" px={2}>
              {statusView.label}
            </Badge>
            <Select
              size="sm"
              value={expense.status || "aguardando"}
              bg={statusView.bg}
              color={statusView.color}
              fontWeight="800"
              onChange={(event) => updateStatus(expense.id, event.target.value)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Stack>
        </Td>
      );
    }

    return null;
  }

  const welcomePanel = (
    <HeroCard h="100%" p={{ base: 4, md: 5 }}>
      <Stack spacing={4}>
        <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={3}>
          <Stack spacing={1}>
            <HStack flexWrap="wrap">
              <Badge colorScheme="brand" borderRadius="full" px={3} py={1}>
                Dashboard financeiro
              </Badge>
              <Badge colorScheme={urgency.colorScheme} borderRadius="full" px={3} py={1}>
                {urgency.label}
              </Badge>
            </HStack>
            <Heading size={{ base: "md", md: "lg" }}>Bem-vindo, {user.email}</Heading>
            <Text color={mutedText} fontSize="sm">
              {timeLabel}
            </Text>
          </Stack>
          <HStack flexWrap="wrap" justify="flex-end">
            <IconButton
              aria-label="Alternar tema"
              icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
              variant="outline"
              onClick={toggleColorMode}
            />
            <Menu>
              <MenuButton as={Button} colorScheme="brand" variant="outline">
                {user.email}
              </MenuButton>
              <MenuList>
                <MenuItem onClick={profileModal.onOpen}>Editar usuário e senha</MenuItem>
                <MenuItem color="rose.500" onClick={onLogout}>
                  Sair
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 2, xl: 1 }} spacing={2}>
          <SummaryCard label="Salario" value={formatMoney(salary)} help={monthLabel} colorScheme="mint" />
          <SummaryCard label="Gastos" value={formatMoney(summary.total)} help={`${expenses.length} despesa(s)`} colorScheme="peach" />
          <SummaryCard
            label="Saldo previsto"
            value={formatMoney(summary.balance)}
            help={`Dia ${formatMoney(summary.dailyBalance)}`}
            colorScheme={summary.balance >= 0 ? "sky" : "rose"}
          />
          <SummaryCard label="Dividas totais" value={formatMoney(totalDebtBalance)} help="Renegociar" colorScheme="lavender" />
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
                            <Badge colorScheme={statusView.colorScheme} borderRadius="full" px={2} mt={1}>
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
                    <FormControl>
                      <FormLabel>Categoria</FormLabel>
                      <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
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
                        <Input placeholder="12 ou 1/12" value={form.installment} onChange={(event) => setForm({ ...form, installment: event.target.value })} />
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
                                <Select size="sm" value={row.category} onChange={(event) => updateBulkRow(index, { category: event.target.value })}>
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
          <ModalHeader>Editar usuário</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack as="form" id="profile-form" spacing={4} onSubmit={handleProfileSubmit}>
              <FormControl>
                <FormLabel>Usuário</FormLabel>
                <Input value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel>Senha</FormLabel>
                <Input
                  type="password"
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
              Salvar usuário
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

function isSameCopiedExpense(source, target) {
  if (getExpenseIdentity(source) === getExpenseIdentity(target)) {
    return true;
  }

  const sourceSeries = getInstallmentSeriesIdentity(source);
  const targetSeries = getInstallmentSeriesIdentity(target);
  return Boolean(sourceSeries && targetSeries && sourceSeries === targetSeries);
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
