import {
  Badge,
  Box,
  Button,
  Center,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
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
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { loadAdminData } from "../lib/cloudFinance.js";
import { formatMoney, formatMonthYear, STATUS_LABELS } from "../lib/finance.js";
import { supabase } from "../lib/supabase.js";
import { notify } from "../toast.js";

export default function AdminDashboard({ isOpen, onClose }) {
  const [data, setData] = useState({ profiles: [], months: [] });
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState(null);
  const cardBg = useColorModeValue("white", "whiteAlpha.100");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.200");
  const rowHover = useColorModeValue("gray.50", "whiteAlpha.100");

  async function refresh() {
    setLoading(true);
    try {
      setData(await loadAdminData());
    } catch (error) {
      notify({ status: "error", title: "Erro na área administrativa", description: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen]);

  const selectedProfile = data.profiles.find((profile) => profile.id === selectedUserId) || null;
  const userMonths = useMemo(() => data.months
    .filter((month) => month.user_id === selectedUserId)
    .sort((a, b) => b.year - a.year || b.month - a.month), [data.months, selectedUserId]);
  const selectedMonth = userMonths.find((month) => `${month.year}-${month.month}` === selectedPeriod) || null;
  const selectedExpenses = Array.isArray(selectedMonth?.expenses) ? selectedMonth.expenses : [];
  const selectedTotal = selectedExpenses.reduce((sum, expense) => sum + Number(expense.value || 0), 0);

  function openUser(profile) {
    const months = data.months
      .filter((month) => month.user_id === profile.id)
      .sort((a, b) => b.year - a.year || b.month - a.month);
    setSelectedUserId(profile.id);
    setSelectedPeriod(months[0] ? `${months[0].year}-${months[0].month}` : "");
  }

  async function setTemporaryPassword(profile) {
    const password = window.prompt(`Defina uma senha temporária para ${profile.username || profile.email}:`);
    if (password === null) return;
    if (password.length < 8) {
      notify({ status: "warning", title: "Senha muito curta", description: "Use pelo menos 8 caracteres." });
      return;
    }

    setResettingPasswordUserId(profile.id);
    try {
      await callAdminFunction("admin-reset-password", { userId: profile.id, password });
      notify({
        status: "success",
        title: "Senha temporária definida",
        description: `O usuário deverá entrar com ${profile.username} e a senha temporária.`,
      });
    } catch (error) {
      notify({ status: "error", title: "Não foi possível alterar", description: error.message });
    } finally {
      setResettingPasswordUserId(null);
    }
  }

  async function deleteUser(profile) {
    if (profile.role === "admin") {
      notify({ status: "warning", title: "Conta protegida", description: "A conta administradora não pode ser excluída por este painel." });
      return;
    }
    const typedUsername = window.prompt(
      `Esta ação apagará a conta e todos os dados financeiros de ${profile.username}. Para confirmar, digite o nome de usuário:\n\n${profile.username}`,
    );
    if (typedUsername === null) return;
    if (typedUsername.trim().toLowerCase() !== String(profile.username).toLowerCase()) {
      notify({ status: "warning", title: "Exclusão cancelada", description: "O usuário digitado não confere." });
      return;
    }

    setDeletingUserId(profile.id);
    try {
      await callAdminFunction("admin-delete-user", { userId: profile.id });
      if (selectedUserId === profile.id) {
        setSelectedUserId(null);
        setSelectedPeriod("");
      }
      await refresh();
      notify({ status: "success", title: "Usuário excluído", description: "A conta e os dados financeiros foram removidos." });
    } catch (error) {
      notify({ status: "error", title: "Não foi possível excluir", description: error.message });
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack justify="space-between" pr={12} flexWrap="wrap" gap={3}>
            <Box>
              <Heading size="lg">Administração</Heading>
              <Text color="gray.500" fontSize="sm">Usuários cadastrados e visão mensal das dívidas</Text>
            </Box>
            <Button variant="outline" colorScheme="brand" onClick={refresh} isLoading={loading}>Atualizar</Button>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={8}>
          {loading && data.profiles.length === 0 ? (
            <Center minH="50vh"><Spinner size="xl" color="brand.500" /></Center>
          ) : (
            <Stack spacing={6}>
              <SimpleGrid columns={{ base: 1, md: selectedProfile ? 3 : 1 }} spacing={4}>
                <AdminStat label="Usuários cadastrados" value={data.profiles.length} bg={cardBg} borderColor={borderColor} />
                {selectedProfile ? <AdminStat label="Dívidas no mês" value={selectedExpenses.length} bg={cardBg} borderColor={borderColor} /> : null}
                {selectedProfile ? <AdminStat label="Total do mês" value={formatMoney(selectedTotal)} bg={cardBg} borderColor={borderColor} /> : null}
              </SimpleGrid>

              <Box border="1px solid" borderColor={borderColor} borderRadius="20px" overflow="hidden">
                <Box px={4} py={3} bg={cardBg}>
                  <Heading size="sm">Lista de usuários</Heading>
                  <Text color="gray.500" fontSize="sm">Escolha um usuário para visualizar apenas um mês.</Text>
                </Box>
                <TableContainer>
                  <Table size="sm">
                    <Thead><Tr><Th>Usuário</Th><Th>Perfil</Th><Th>Cadastro</Th><Th>Ações</Th></Tr></Thead>
                    <Tbody>
                      {data.profiles.map((profile) => (
                        <Tr key={profile.id} bg={selectedUserId === profile.id ? rowHover : undefined} _hover={{ bg: rowHover }}>
                          <Td>
                            <Text fontWeight="700">{profile.username || "Usuário"}</Text>
                          </Td>
                          <Td><Badge colorScheme={profile.role === "admin" ? "lavender" : "gray"}>{profile.role === "admin" ? "Administrador" : "Usuário"}</Badge></Td>
                          <Td>{new Date(profile.created_at).toLocaleDateString("pt-BR")}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <Button
                                size="xs"
                                variant="outline"
                                colorScheme="rose"
                                isLoading={resettingPasswordUserId === profile.id}
                                onClick={() => setTemporaryPassword(profile)}
                              >
                                Senha temporária
                              </Button>
                              <Button size="xs" colorScheme="brand" onClick={() => openUser(profile)}>Ver dívidas</Button>
                              <Button
                                size="xs"
                                colorScheme="rose"
                                variant="ghost"
                                isLoading={deletingUserId === profile.id}
                                isDisabled={profile.role === "admin"}
                                onClick={() => deleteUser(profile)}
                              >
                                Excluir usuário
                              </Button>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>

              {selectedProfile ? (
                <Box border="1px solid" borderColor={borderColor} borderRadius="20px" overflow="hidden">
                  <HStack px={4} py={3} bg={cardBg} justify="space-between" flexWrap="wrap" gap={3}>
                    <Box>
                      <Heading size="sm">Dívidas de {selectedProfile.username || selectedProfile.email}</Heading>
                      <Text color="gray.500" fontSize="sm">Uma linha por dívida no mês selecionado.</Text>
                    </Box>
                    <Select size="sm" maxW="260px" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>
                      {!userMonths.length ? <option value="">Nenhum mês salvo</option> : null}
                      {userMonths.map((month) => <option key={`${month.year}-${month.month}`} value={`${month.year}-${month.month}`}>{formatMonthYear(month.year, month.month)}</option>)}
                    </Select>
                  </HStack>
                  <TableContainer>
                    <Table size="sm">
                      <Thead><Tr><Th>Dívida</Th><Th>Categoria</Th><Th>Parcela</Th><Th>Status</Th><Th isNumeric>Valor</Th></Tr></Thead>
                      <Tbody>
                        {selectedExpenses.map((expense, index) => (
                          <Tr key={expense.id || `${expense.name}-${index}`}>
                            <Td fontWeight="600">{expense.name}</Td>
                            <Td>{expense.category || "Outros"}</Td>
                            <Td>{expense.installment || "—"}</Td>
                            <Td>{STATUS_LABELS[expense.status] || expense.status}</Td>
                            <Td isNumeric>{formatMoney(expense.value)}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                  {!selectedExpenses.length ? <Text p={5} color="gray.500" textAlign="center">Nenhuma dívida encontrada neste mês.</Text> : null}
                </Box>
              ) : null}
            </Stack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

async function callAdminFunction(functionName, payload) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error("Sua sessão expirou. Saia do app, entre novamente e tente outra vez.");
  }

  let response;
  try {
    response = await fetch(`/.netlify/functions/${functionName}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Não foi possível acessar o serviço administrativo. Verifique sua conexão e tente novamente.");
  }

  const responseText = await response.text();
  let result = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = {};
    }
  }

  if (!response.ok) {
    const localHint = response.status === 404 && window.location.hostname === "127.0.0.1"
      ? "As ações administrativas usam funções do Netlify e não ficam disponíveis no servidor Vite local. Teste esta ação no site publicado."
      : "O serviço administrativo não retornou uma resposta válida. Confira a configuração da função no Netlify.";
    throw new Error(result.error || localHint);
  }

  return result;
}

function AdminStat({ label, value, ...boxProps }) {
  return (
    <Box border="1px solid" borderRadius="18px" p={4} {...boxProps}>
      <Stat><StatLabel>{label}</StatLabel><StatNumber>{value}</StatNumber></Stat>
    </Box>
  );
}
