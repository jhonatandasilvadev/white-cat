import {
  Badge,
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  List,
  ListIcon,
  ListItem,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { CheckCircleIcon } from "@chakra-ui/icons";
import HeroCard from "./HeroCard.jsx";
import { notify } from "../toast.js";
import { getUsers, saveUsers } from "../lib/storage.js";
import { useState } from "react";

const benefits = [
  "Painel executivo com salário, total de gastos e saldo previsto do mês.",
  "Despesas com vencimento, parcelas (ex.: 2/12) e categorias em um só lugar.",
  "Alertas inteligentes para contas que vencem hoje, com relógio em Brasília.",
  "Lista editável, ordenada por dia de vencimento, com ações rápidas.",
  "Seus dados ficam no seu navegador - privacidade e acesso imediato.",
];

export default function AuthScreen({ onLogin }) {
  const headingColor = useColorModeValue("gray.800", "whiteAlpha.900");
  const bodyColor = useColorModeValue("gray.600", "gray.200");
  const listColor = useColorModeValue("gray.700", "gray.100");
  const tabsBg = useColorModeValue("whiteAlpha.700", "whiteAlpha.200");
  const labelColor = useColorModeValue("gray.700", "gray.100");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [register, setRegister] = useState({ username: "", password: "" });

  function submitLogin(event) {
    event.preventDefault();
    const username = login.username.trim();
    const user = getUsers().find((item) => item.email === username && item.password === login.password);

    if (!user) {
      notify({ status: "error", title: "Usuário não encontrado", description: "Confira usuário e senha para continuar." });
      return;
    }

    notify({ status: "success", title: "Bem-vindo", description: "Seu painel financeiro está pronto." });
    onLogin(user);
  }

  function submitRegister(event) {
    event.preventDefault();
    if (!register.username || !register.password) {
      notify({ status: "warning", title: "Preencha os dados", description: "Usuário e senha são obrigatórios." });
      return;
    }

    const users = getUsers();
    const username = register.username.trim();

    if (users.some((user) => user.email === username)) {
      notify({ status: "warning", title: "Conta já existe", description: "Entre com esse usuário ou escolha outro nome." });
      return;
    }

    const user = { email: username, password: register.password };
    saveUsers([...users, user]);
    notify({ status: "success", title: "Conta criada", description: "Seu painel financeiro já está pronto." });
    setRegister({ username: "", password: "" });
    onLogin(user);
  }

  return (
    <Box minH="100vh" py={{ base: 8, md: 14 }}>
      <Container maxW="1180px">
        <Stack direction={{ base: "column", lg: "row" }} spacing={{ base: 8, lg: 12 }} align="center">
          <Stack flex="1" spacing={7}>
            <Badge alignSelf="flex-start" colorScheme="mint" borderRadius="full" px={4} py={2}>
              Planejamento financeiro
            </Badge>
            <Stack spacing={4}>
              <Heading size={{ base: "xl", md: "2xl" }} lineHeight="1.08" color={headingColor}>
                O controle do seu mês, com a clareza de um produto premium.
              </Heading>
              <Text fontSize={{ base: "lg", md: "xl" }} color={bodyColor} maxW="680px">
                Acompanhe saldo previsto, compromissos e vencimentos em um painel mensal desenhado para decisões rápidas.
              </Text>
            </Stack>
            <HeroCard p={{ base: 5, md: 7 }}>
              <Heading size="md" mb={4}>
                O que voce ganha
              </Heading>
              <List spacing={3}>
                {benefits.map((benefit) => (
                  <ListItem key={benefit} display="flex" color={listColor}>
                    <ListIcon as={CheckCircleIcon} color="mint.500" mt={1} />
                    {benefit}
                  </ListItem>
                ))}
              </List>
            </HeroCard>
          </Stack>

          <HeroCard w="100%" maxW="440px" p={{ base: 5, md: 7 }}>
            <Tabs isFitted colorScheme="brand" variant="soft-rounded">
              <TabList bg={tabsBg} p={1} borderRadius="full">
                <Tab>Entrar</Tab>
                <Tab>Criar conta</Tab>
              </TabList>
              <TabPanels>
                <TabPanel px={0} pb={0}>
                  <Stack as="form" spacing={4} onSubmit={submitLogin}>
                    <FormControl>
                      <FormLabel color={labelColor}>Usuário</FormLabel>
                      <Input value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel color={labelColor}>Senha</FormLabel>
                      <Input
                        type="password"
                        value={login.password}
                        onChange={(event) => setLogin({ ...login, password: event.target.value })}
                      />
                    </FormControl>
                    <Button type="submit" colorScheme="brand" size="lg">
                      Entrar
                    </Button>
                  </Stack>
                </TabPanel>
                <TabPanel px={0} pb={0}>
                  <Stack as="form" spacing={4} onSubmit={submitRegister}>
                    <FormControl>
                      <FormLabel color={labelColor}>Usuário</FormLabel>
                      <Input
                        value={register.username}
                        onChange={(event) => setRegister({ ...register, username: event.target.value })}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel color={labelColor}>Senha</FormLabel>
                      <Input
                        type="password"
                        value={register.password}
                        onChange={(event) => setRegister({ ...register, password: event.target.value })}
                      />
                    </FormControl>
                    <Button type="submit" colorScheme="lavender" size="lg">
                      Criar conta
                    </Button>
                  </Stack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </HeroCard>
        </Stack>
      </Container>
    </Box>
  );
}
