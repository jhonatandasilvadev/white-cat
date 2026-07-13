import {
  Badge,
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  InputGroup,
  InputRightElement,
  List,
  ListIcon,
  ListItem,
  SimpleGrid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { CheckCircleIcon, ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { useState } from "react";
import { authenticateLegacyUser } from "../lib/legacyAuth.js";
import { ADMIN_EMAIL, ADMIN_USERNAME, normalizeUsername, supabase, usernameToAuthEmail } from "../lib/supabase.js";
import { notify } from "../toast.js";
import HeroCard from "./HeroCard.jsx";

const benefits = [
  "Painel executivo com salário, total de gastos e saldo previsto do mês.",
  "Despesas com vencimento, parcelas e categorias em um só lugar.",
  "Dados protegidos por conta e sincronizados entre seus dispositivos.",
  "Alertas inteligentes e organização mensal de pagamentos.",
  "Acesso simples e seguro usando apenas seu usuário e senha.",
];

export default function AuthScreen({ onLegacyLogin }) {
  const headingColor = useColorModeValue("gray.800", "whiteAlpha.900");
  const bodyColor = useColorModeValue("gray.600", "gray.200");
  const listColor = useColorModeValue("gray.700", "gray.100");
  const tabsBg = useColorModeValue("whiteAlpha.700", "whiteAlpha.200");
  const labelColor = useColorModeValue("gray.700", "gray.100");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [register, setRegister] = useState({ username: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    setSubmitting(true);
    const username = normalizeUsername(login.username);
    const authEmail = username === ADMIN_USERNAME || username === "john" ? ADMIN_EMAIL : usernameToAuthEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: login.password });
    if (!error) {
      setSubmitting(false);
      notify({ status: "success", title: "Bem-vindo", description: "Seu painel financeiro está pronto." });
      return;
    }

    const legacyUser = authenticateLegacyUser(login.username, login.password);
    if (legacyUser) {
      onLegacyLogin(legacyUser);
      notify({ status: "info", title: "Acesso local preservado", description: "Confirme seu usuário e senha no aviso de atualização." });
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    notify({ status: "error", title: "Não foi possível entrar", description: "Confira seu usuário e senha." });
  }

  async function submitRegister(event) {
    event.preventDefault();
    const username = normalizeUsername(register.username);
    if (!username || register.password.length < 6) {
      notify({ status: "warning", title: "Revise os dados", description: "Informe o usuário e uma senha com pelo menos 6 caracteres." });
      return;
    }
    if (username === ADMIN_USERNAME || username === "john") {
      notify({ status: "warning", title: "Usuário reservado", description: "Escolha outro nome de usuário." });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: usernameToAuthEmail(username),
      password: register.password,
      options: { data: { username } },
    });
    setSubmitting(false);
    if (error) {
      notify({ status: "error", title: "Não foi possível criar a conta", description: getSignupErrorMessage(error) });
      return;
    }

    if (!data.session) {
      notify({ status: "error", title: "Cadastro aguardando confirmação", description: "Desative a confirmação de e-mail no Supabase para usar o login somente com usuário e senha." });
      return;
    }
    setRegister({ username: "", password: "" });
    notify({
      status: "success",
      title: "Conta criada",
      description: "Seu painel já está pronto.",
    });
  }

  return (
    <Box minH="100vh" py={{ base: 8, md: 12 }} display="flex" alignItems="center">
      <Container maxW="1120px">
        <Stack spacing={{ base: 7, md: 9 }} align="center">
          <Stack spacing={4} align="center" w="100%" maxW="760px">
            <Badge alignSelf="flex-start" colorScheme="mint" borderRadius="full" px={4} py={2}>Planejamento financeiro</Badge>
            <Heading size={{ base: "xl", md: "2xl" }} lineHeight="1.08" color={headingColor} textAlign="left" w="100%">
              O controle do seu mês, com a clareza de um produto premium.
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color={bodyColor} textAlign="left" w="100%">
              Acompanhe saldo previsto, compromissos e vencimentos em um painel mensal seguro e sincronizado.
            </Text>
          </Stack>

          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 6, lg: 8 }} alignItems="stretch" w="100%" maxW="960px">
            <HeroCard p={{ base: 5, md: 6 }} h="100%">
              <Heading size="md" mb={4}>O que você ganha</Heading>
              <List spacing={3}>
                {benefits.map((benefit) => (
                  <ListItem key={benefit} display="flex" color={listColor} textAlign="left">
                    <ListIcon as={CheckCircleIcon} color="mint.500" mt={1} />{benefit}
                  </ListItem>
                ))}
              </List>
            </HeroCard>

            <HeroCard w="100%" p={{ base: 5, md: 6 }} h="100%">
              <Tabs isFitted colorScheme="brand" variant="soft-rounded">
                <TabList bg={tabsBg} p={1} borderRadius="full"><Tab>Entrar</Tab><Tab>Criar conta</Tab></TabList>
                <TabPanels>
                  <TabPanel px={0} pb={0}>
                    <Stack as="form" spacing={4} onSubmit={submitLogin}>
                      <FormControl isRequired>
                        <FormLabel color={labelColor}>Usuário</FormLabel>
                        <Input autoComplete="username" value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel color={labelColor}>Senha</FormLabel>
                        <InputGroup>
                          <Input type={showLoginPassword ? "text" : "password"} autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} pr="3rem" />
                          <InputRightElement>
                            <Button type="button" size="sm" variant="ghost" px={0} minW="2.5rem" aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowLoginPassword((current) => !current)}>
                              {showLoginPassword ? <ViewOffIcon /> : <ViewIcon />}
                            </Button>
                          </InputRightElement>
                        </InputGroup>
                      </FormControl>
                      <Button type="submit" colorScheme="brand" size="lg" isLoading={submitting}>Entrar</Button>
                    </Stack>
                  </TabPanel>
                  <TabPanel px={0} pb={0}>
                    <Stack as="form" spacing={4} onSubmit={submitRegister}>
                      <FormControl isRequired>
                        <FormLabel color={labelColor}>Usuário</FormLabel>
                        <Input autoComplete="username" value={register.username} onChange={(event) => setRegister({ ...register, username: event.target.value })} />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel color={labelColor}>Senha</FormLabel>
                        <InputGroup>
                          <Input type={showRegisterPassword ? "text" : "password"} minLength={6} autoComplete="new-password" value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} pr="3rem" />
                          <InputRightElement>
                            <Button type="button" size="sm" variant="ghost" px={0} minW="2.5rem" aria-label={showRegisterPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowRegisterPassword((current) => !current)}>
                              {showRegisterPassword ? <ViewOffIcon /> : <ViewIcon />}
                            </Button>
                          </InputRightElement>
                        </InputGroup>
                      </FormControl>
                      <Button type="submit" colorScheme="lavender" size="lg" isLoading={submitting}>Criar conta</Button>
                    </Stack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </HeroCard>
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}

function getSignupErrorMessage(error) {
  if (String(error?.message || "").toLowerCase().includes("email signups are disabled")) {
    return "No Supabase, habilite o provedor Email e a opção de novos cadastros, mas deixe Confirm email desativado. Nenhum e-mail será solicitado ou enviado pelo White Cat.";
  }
  return error?.message || "Não foi possível concluir o cadastro.";
}
