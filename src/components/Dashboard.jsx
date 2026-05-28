import {
  Badge,
  Box,
  Button,
  ButtonGroup,
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
  Table,
  TableContainer,
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
import { AddIcon, DeleteIcon, EditIcon, MoonIcon, SunIcon } from "@chakra-ui/icons";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { useEffect, useMemo, useState } from "react";
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

    if (!form.name || form.value === "") {
      notify({ status: "warning", title: "Revise a despesa", description: "Descrição e valor são obrigatórios." });
      return;
    }

    const payload = {
      ...form,
      value: Number(form.value),
      dueDate: form.dueDate === "" ? "" : Number(form.dueDate),
      status: form.status || "aguardando",
      debtBalance: form.debtBalance === "" ? "" : Number(form.debtBalance),
      note: form.note || "",
    };

    if (editingId) {
      persistExpenses(expenses.map((expense) => (expense.id === editingId ? { ...payload, id: editingId } : expense)));
      notify({ status: "success", title: "Despesa atualizada" });
    } else {
      persistExpenses([...expenses, { ...payload, id: Date.now() }]);
      notify({ status: "success", title: "Despesa adicionada" });
    }

    setForm(emptyForm);
    setEditingId(null);
    expenseModal.onClose();
  }

  function editExpense(expense) {
    setEditingId(expense.id);
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

    if (nextExpenses.length > 0) {
      notify({
        status: "warning",
        title: "Próximo mês já tem despesas",
        description: `${nextMonthLabel} já possui lançamentos. Use "Copiar despesas de outro mês" para substituir ou somar.`,
      });
      return;
    }

    const copied = expenses.map((expense, index) => ({ ...expense, id: Date.now() + index, status: "aguardando" }));
    saveExpenses(user.email, next.year, next.month, copied);

    if (!getSalary(user.email, next.year, next.month)) {
      saveSalary(user.email, next.year, next.month, salary);
    }

    notify({
      status: "success",
      title: "Copiado para o próximo mês",
      description: `${copied.length} despesa(s) de ${monthLabel} foram enviadas para ${nextMonthLabel}.`,
    });
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

  return (
    <Box minH="100vh" py={{ base: 3, md: 5 }}>
      <Container maxW="1280px">
        <Stack spacing={4}>
          <HeroCard p={{ base: 4, md: 5 }}>
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
                <HStack>
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

              <SimpleGrid columns={{ base: 2, xl: 4 }} spacing={2}>
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

          <HeroCard p={{ base: 4, md: 5 }}>
            <Stack spacing={3}>
              <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={3}>
                <Box>
                  <Text fontWeight="800">Pasta do mês</Text>
                  <Text color={softText}>{monthLabel}</Text>
                </Box>
                <HStack>
                  <Button size="xs" variant="outline" colorScheme="brand" onClick={copyToNextMonth}>
                    Copiar para próximo mês
                  </Button>
                  <Box fontSize="2xl">📁</Box>
                </HStack>
              </HStack>
              <HStack align="end" flexWrap="wrap" gap={3}>
                <FormControl maxW={{ base: "100%", sm: "160px" }}>
                  <FormLabel fontSize="sm">Ano</FormLabel>
                <Select value={selected.year} onChange={(event) => setSelected({ ...selected, year: Number(event.target.value) })}>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              </FormControl>
                <FormControl maxW={{ base: "100%", sm: "220px" }}>
                  <FormLabel fontSize="sm">Salário mensal</FormLabel>
                  <NumberInput value={salary} min={0} onChange={(_, value) => persistSalary(Number.isNaN(value) ? 0 : value)}>
                    <NumberInputField placeholder="3000" />
                  </NumberInput>
                </FormControl>
              </HStack>
              <ButtonGroup flexWrap="wrap" spacing={2} gap={2} bg={subtleBg} borderRadius="20px" p={2}>
                {MONTHS.map((month, index) => (
                  <Button
                    key={month}
                    size="sm"
                    colorScheme={selected.month === index + 1 ? "brand" : "gray"}
                    variant={selected.month === index + 1 ? "solid" : "outline"}
                    onClick={() => setSelected({ ...selected, month: index + 1 })}
                  >
                    {month}
                  </Button>
                ))}
              </ButtonGroup>
            </Stack>
          </HeroCard>

            <HeroCard p={{ base: 4, md: 5 }}>
              <Stack spacing={4}>
                <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                  <Box>
                    <Heading size="md">Despesas</Heading>
                    <Text color="gray.500">{monthLabel}</Text>
                  </Box>
                  <HStack flexWrap="wrap">
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
                              {expense.name}
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
                        <Th>Categoria</Th>
                        <Th isNumeric>Valor</Th>
                        <Th isNumeric>Divida total</Th>
                        <Th>Vencimento</Th>
                        <Th>Parcela</Th>
                        <Th>Status</Th>
                        <Th>Observação</Th>
                        <Th>Acoes</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {sortedExpenses.map((expense) => {
                        const statusView = getExpenseStatusView(expense);

                        return (
                          <Tr key={expense.id}>
                            <Td fontWeight="700">{expense.name}</Td>
                            <Td>{expense.category || "—"}</Td>
                            <Td isNumeric>{formatMoney(expense.value)}</Td>
                            <Td isNumeric>{expense.debtBalance ? formatMoney(expense.debtBalance) : "—"}</Td>
                            <Td>{expense.dueDate ? `Dia ${expense.dueDate}` : "—"}</Td>
                            <Td>{expense.installment || "—"}</Td>
                            <Td minW="170px">
                              <Stack spacing={1}>
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
                            <Td maxW="280px" whiteSpace="normal">
                              {expense.note || "—"}
                            </Td>
                            <Td>
                              <HStack>
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
        </Stack>
      </Container>

      <Modal isOpen={expenseModal.isOpen} onClose={expenseModal.onClose} isCentered size="xl">
        <ModalOverlay />
        <ModalContent borderRadius="24px">
          <ModalHeader>{editingId ? "Editar despesa" : "Adicionar despesa"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack as="form" id="expense-form" spacing={4} onSubmit={handleSubmit}>
              <FormControl>
                <FormLabel>Descricao</FormLabel>
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
                  <Input type="number" step="0.01" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel>Divida total</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.debtBalance}
                    onChange={(event) => setForm({ ...form, debtBalance: event.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Vencimento</FormLabel>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dueDate}
                    onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                  />
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl>
                  <FormLabel>Parcela</FormLabel>
                  <Input value={form.installment} onChange={(event) => setForm({ ...form, installment: event.target.value })} />
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
              <FormControl>
                <FormLabel>Observação</FormLabel>
                <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={expenseModal.onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="expense-form" leftIcon={<AddIcon />} colorScheme="mint">
              {editingId ? "Salvar edição" : "Adicionar"}
            </Button>
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
