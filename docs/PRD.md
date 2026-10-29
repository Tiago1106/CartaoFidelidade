# PRD: cartão de fidelidade para salões e barbearias

Nome do produto: **Freguês**. Slogan: **"Quem volta, ganha."** (para o dono, nos anúncios: "Faça seu cliente voltar."). O domínio ainda está em aberto. Estado deste documento: pronto para iniciar o desenvolvimento do MVP.

Convenção: **[Decidido]** foi definido pelo Tiago. **[Premissa]** foi assumido pelo documento para fechar uma lacuna e deve ser revisado.

---

## 1. Resumo

Um PWA em que o cliente de um salão ou barbearia acumula visitas em cartões de fidelidade e o salão registra cada visita lendo o QR Code do cliente depois do pagamento. O cliente entra só com o celular (código por SMS), sem baixar app de loja. O salão cria os próprios cartões e prêmios, tem equipe com login próprio e acompanha um painel simples. O produto é multi-tenant e cobrado por assinatura mensal.

## 2. Problema e oportunidade

- Salões e barbearias vivem de clientes recorrentes, mas o cartão de papel se perde, é fácil de fraudar e não dá nenhum dado ao dono.
- Os sistemas de gestão que já existem (agenda, comanda, financeiro) são grandes e caros para quem só quer fidelizar. [Decidido: o produto não compete com ERPs.]
- A oportunidade é um produto pequeno, fácil de implantar (o dono se cadastra sozinho, a etiqueta NFC e o QR do balcão são o único material) e com preço acessível.

## 3. Público e personas

| Persona | Quem é | O que precisa |
|---|---|---|
| **Cliente** | Pessoa que corta cabelo ou faz a barba com frequência. | Entrar rápido, sem instalar nada, ver o progresso e saber quando ganha o prêmio. |
| **Funcionário** | Barbeiro, cabeleireiro ou recepcionista no balcão. | Registrar a visita em segundos, sem treino, no próprio celular. |
| **Dono** | Dono do salão, pequeno empresário, muitas vezes pouco técnico. | Criar o cartão sozinho, controlar a equipe, ver se o programa traz clientes de volta. |

Mercado inicial: salões e barbearias de pequeno e médio porte no Brasil, de cerca de 50 a 1.000 atendimentos por semana. Os primeiros clientes vêm de venda porta a porta. [Decidido]

## 4. Como funciona

1. **O dono** se cadastra no site, cria um cartão ("10 cortes = 1 grátis"), convida a equipe e recebe o endereço do salão (`/s/<slug>`) para gravar em uma etiqueta NFC e imprimir como QR no balcão.
2. **O cliente** encosta o celular na etiqueta (ou lê o QR), informa o celular, digita o código do SMS, informa o nome (só no primeiro acesso) e vê o Início com os cartões. O QR é único por cliente, fica na aba Meu QR e renova sozinho a cada 30 segundos, com a contagem na tela.
3. **O funcionário**, depois do pagamento, abre o leitor, lê o QR do cliente, vê o nome e os cartões, confirma e pronto: +1 visita, com data e autor gravados.
4. **O prêmio** é liberado quando o cartão completa, tem validade própria, e é resgatado no balcão da mesma forma.

## 5. Escopo do MVP

### 5.1 Histórias de usuário

**Cliente**

- C1. Entrar no salão pela etiqueta NFC ou QR do balcão e fazer login só com o celular. (RN-ENT-01 a RN-ENT-03, RN-AUT-01 a RN-AUT-06)
- C2. Completar o primeiro acesso só com o nome. O e-mail é opcional e se edita no Perfil. Os termos são aceitos ao continuar na tela do celular. (RN-ENT-07, RN-ENT-08, RN-LGP-02)
- C3. Ver no Início meus cartões empilhados, com progresso e validade, e abrir o QR Code a qualquer momento pela aba Meu QR, mesmo sem nenhum cartão. (RN-ENT-05, RN-ENT-09, RN-QR-01)
- C4. Abrir um cartão: carimbos, o que falta, validade e o QR Code. (RN-VAL-04, RN-PRE-02)
- C5. Ver na hora o carimbo registrado e saber quando um prêmio está disponível e até quando vale. (RN-PRE-01, RN-PRE-07)
- C6. Editar meu nome e e-mail e pedir a exclusão da minha conta pelo Perfil. (RN-LGP-04)

**Funcionário**

- F1. Entrar com e-mail e senha e cair direto no leitor de QR. (RN-AUT-07, RN-VIS-10)
- F2. Ler o QR sem passos extras: o leitor é a tela inicial. (RN-PER-03, RN-VIS-10)
- F3. Ler o QR do cliente, ver nome e cartões (o que está em intervalo aparece bloqueado), escolher o cartão e registrar +1 visita. (RN-VIS-01 a RN-VIS-05)
- F4. Registrar pelo celular do cliente quando o QR não funciona. (RN-VIS-07)
- F5. Resgatar um prêmio. (RN-PRE-03)

**Dono**

- D1. Cadastrar meu salão pelo site e começar o teste grátis de 30 dias, sem cartão. (RN-TEN-04, RN-PLA-01)
- D2. Criar, editar e arquivar cartões, com recompensa, número de visitas, validades e intervalo mínimo. (RN-CAR-01 a RN-CAR-07)
- D3. Convidar e desativar funcionários. (RN-PER-02, RN-PER-05)
- D4. Ver o painel com os dados úteis do período. (RN-DAS-01)
- D5. Ver a lista de clientes e a ficha de cada um, com o histórico. (RN-LGP-05)
- D6. Estornar uma visita registrada por engano, com motivo. (RN-EST-01 a RN-EST-06)
- D7. Assinar o plano pelo Mercado Pago, trocar de plano e cancelar. (RN-PLA-02 a RN-PLA-09)
- D8. Imprimir o QR do balcão e obter o endereço para gravar o NFC. (RN-TEN-05)
- D9. Usar a mesma aplicação no celular e no computador. [Decidido]

**Plataforma**

- P1. Isolamento total entre salões. (RN-TEN-02)
- P2. Página pública simples do produto, com otimização para buscadores e botão para cadastrar o salão. [Decidido: landing estática separada, para aparecer no Google.]
- P3. Termos de uso, política de privacidade e rotina de exclusão de dados. (RN-LGP-01 a RN-LGP-07)

### 5.2 Fora do escopo do MVP (fase 2 em diante)

- Feed de lojas e descoberta de salões. [Decidido: depois]
- Apple Wallet e Google Wallet. [Decidido: não, só PWA]
- Reativação por WhatsApp e lembretes de vencimento.
- Relatórios avançados.
- Fila offline para o funcionário (hoje precisa de internet). [Decidido]
- Multi-unidade e múltiplos administradores. [Decidido]
- Token do QR gerado no aparelho (HMAC/TOTP).
- App nativo.

## 6. Telas

O desenho está em um canvas de design (Claude Design), com as telas aprovadas uma a uma e os componentes reutilizáveis. Os arquivos de referência estão em `docs/design/screens/` (veja o `README.md` da pasta). Cada tela abaixo corresponde a um quadro do canvas, na mesma numeração.

**Cliente** (celular, tema claro, três abas: Cartões, Meu QR e Perfil)

| Nº | Tela | O que faz |
|---|---|---|
| 00 | Página do negócio (`/s/<slug>`) | Aberta pela etiqueta NFC ou pelo QR do balcão. Logo, nome do negócio, prévia dos cartões ativos e "Entrar com meu celular" (RN-ENT-02). Quem já está logado vai direto para o Início. |
| 01 | Como funciona (3 passos) | Onboarding com "Pular". Mostra o QR, os carimbos e o prêmio. |
| 02 | Escolha de perfil | Folha sobre a logo com "Sou cliente" e "Sou do salão". |
| 03 | Entrada: celular | Celular (+55) e aviso dos Termos e da Política. |
| 04 | Entrada: código SMS | Seis dígitos, reenvio com contagem, "Alterar número". |
| 05 | Cadastro: nome | **Só no primeiro acesso.** Pede o nome. |
| 06 | Início: cartões | Cartões empilhados como numa carteira, cada um na cor do cartão, com nome, progresso e validade. |
| 06.1 | Início: cartão selecionado | O cartão tocado abre inteiro no topo, com os carimbos, a validade e o QR Code colado nele (com a contagem de 30 s). Os outros ficam empilhados embaixo. |
| 06.2 | Início: sem cartões | Primeiro acesso. Cartão vazio tracejado e o botão "Mostrar meu QR Code". |
| 06.3 | Cartão: detalhe e visitas | Abre pelo "Ver detalhes" da 06.1. Mostra o cartão e a lista de visitas do ciclo atual, da mais recente para a mais antiga: número da visita, data, hora e quem carimbou. |
| 07 | Meu QR Code | QR grande, vale para todos os cartões, com barra e "Renova em 0:24". |
| 08 | Perfil | Nome, celular, e-mail opcional, Termos, Política, Sair e "Excluir minha conta". |
| 09 | Carimbo registrado | Folha sobre o Início, com o cartão atualizado. |
| 10 | Cartão completo | Folha com o prêmio e o prazo para resgatar. |

**Equipe** (funcionário e dono)

| Nº | Tela | O que faz |
|---|---|---|
| 11 | Entrar | E-mail e senha, "Esqueci minha senha". |
| 12 | Leitor de QR | **Tela inicial do funcionário.** Câmera em tela cheia, botão de conta e "Digitar celular". |
| 13 | Confirmar visita | Nome, celular oculto, escolha do cartão e "Confirmar visita". |
| 13.1 | Confirmar: cartão em intervalo | O cartão em intervalo aparece bloqueado, com "Próximo carimbo às HH:MM". |
| 14 | Visita registrada | Sucesso e "Ler próximo cliente". |
| 15 | Visita muito recente | Intervalo mínimo (`STAMP_TOO_SOON`), com a hora em que o cartão volta a aceitar. |
| 16 | Resgatar prêmio | Prêmio disponível, validade, "O resgate não pode ser desfeito" e "Resgatar prêmio". |
| 17 | Digitar celular | Alternativa quando o QR não abre. |

**Dono** (celular primeiro, barra inferior com cinco abas: Painel, Cartões, Clientes, Equipe e Plano)

| Nº | Tela | O que faz |
|---|---|---|
| 18 | Painel | Período (Hoje, 7 dias, 30 dias), seis indicadores (visitas, clientes ativos, clientes novos, voltaram, prêmios liberados e resgatados), visitas por funcionário e uso do plano. Botão para ler QR Code sempre à vista (RN-DAS-01). |
| 19 | Cartões | Lista de cartões Ativos e Arquivados, "2 de 5 cartões ativos" (RN-CAR-05), "Novo cartão" e a linha "QR do balcão e NFC". |
| 20 | Configurar cartão | Prévia ao vivo do cartão, seletor de cor (8 opções com contraste garantido), nome, recompensa, visitas para completar, validade dos pontos, validade do prêmio e intervalo entre visitas. Mudanças valem para os próximos ciclos (RN-CAR-04). |
| 21 | Clientes | Busca por nome ou celular, filtros Todos, Com prêmio e Inativos, lista com iniciais e última visita. |
| 22 | Ficha do cliente | Contato, total de visitas e prêmios resgatados, progresso por cartão e histórico. "Estornar" aparece na visita mais recente. |
| 23 | Equipe | Funcionários com visitas no mês, estado (Ativo, Convite pendente, Inativo) e "Convidar funcionário". |
| 24 | Convidar funcionário | Folha com nome e e-mail. O convite vale 7 dias (RN-PER-02). |
| 25 | Plano e cobrança | Plano atual, uso do mês, próxima cobrança, troca de plano, cancelar. Preços são a hipótese de RN-PLA-03. |
| 26 | QR do balcão | QR fixo para imprimir ou compartilhar e o endereço `/s/<slug>` para gravar na etiqueta NFC. Entrada pela linha "QR do balcão e NFC" na tela 19. |
| 27 | Estornar visita | Folha sobre a ficha, com o efeito do estorno e motivo obrigatório (RN-EST-01, RN-EST-04). |

**Regras de interface que valem para todas as telas**

- Tema só claro. Cor primária âmbar. Fonte Manrope. Tokens do documento `CLAUDE.md`.
- **Cartão do cliente**: visual de carteira. Cada cartão tem uma cor (escolhida pelo dono) e mostra nome, progresso, 10 carimbos em 2 linhas de 5, **Validade** e **Prêmio** (quantos faltam ou "Disponível"). Os carimbos marcados são o **selo do Freguês com as cores invertidas** (corpo âmbar, F escuro). Os vazios são círculos tracejados.
- Folhas (bottom sheets) fecham com o botão X no canto superior direito. Não há botão "Fechar" embaixo.
- O QR sempre mostra a contagem de renovação (barra e "Renova em 0:NN").
- O funcionário abre direto no leitor. O botão de conta fica no topo do leitor. [Decidido]
- Cliente e prestador usam o mesmo aplicativo, e o prestador funciona no celular e na web. [Decidido]
- A navegação mostra só o que o papel permite: o funcionário não vê Painel, Clientes, Equipe e Plano. [Decidido]
- Marca: o selo de carimbo com F, o nome "Freguês" (sempre com acento nos textos) e o slogan. Arquivos e regras de uso em `docs/design/logo/`.
- Textos para o cliente evitam "salão" quando falam de forma geral ("quem te atende"), porque o produto serve a vários negócios.
- Os nomes e os números nas telas do canvas são dados de exemplo.

**Telas que ainda faltam** (antes ou durante os marcos M1 a M6): versão web do painel do dono; cadastro do dono no site; convite e recuperação de senha (e-mail e telas). Não há telas de erro de rede: o app é PWA e, sem internet, mostra só uma mensagem simples. O QR vencido e o modo somente leitura viram avisos nas telas existentes, sem tela própria.

## 7. Requisitos não funcionais

- **Desempenho**: registrar uma visita (do QR lido à confirmação na tela) em até 3 segundos em 4G; resposta de `scan/resolve` e `stamps` em até 300 ms no servidor (p95). [Premissa]
- **Segurança**: isolamento por RLS; tokens de QR de uso único; limites de uso; senhas com Argon2id; sessões revogáveis; HTTPS em tudo; nenhum segredo no repositório; nenhum dado pessoal em logs. Detalhes em `BUSINESS_RULES.md` (seções 6 e 11).
- **PWA**: instalável, com ícone e tela cheia (`display: standalone`); o shell do app funciona em cache, e dados ao vivo exigem internet. Sem internet, mostra mensagem clara (não há fila offline no MVP).
- **Câmera**: o leitor usa `getUserMedia` (exige HTTPS) com a API `BarcodeDetector` quando existir e uma biblioteca de leitura como alternativa (Safari e outros).
- **Acessibilidade**: WCAG 2.2 AA. Alvos de toque de pelo menos 44 px, estado nunca só por cor, anel de foco visível, rótulos em todos os campos.
- **Idioma e região**: português do Brasil, fuso America/Sao_Paulo, moeda em reais (valores em centavos no sistema).
- **Disponibilidade e dados**: backup diário do banco com teste de restauração; monitoramento de erros; meta de disponibilidade de 99,5%. [Premissa]
- **LGPD**: consentimentos registrados, exclusão por anonimização, log de auditoria, e-mail do encarregado. Revisão jurídica antes de cobrar. (RN-LGP-01 a RN-LGP-07)

## 8. Arquitetura (resumo)

| Peça | Escolha |
|---|---|
| API | NestJS (TypeScript) + Postgres, REST em `/v1`. [Decidido] |
| App (cliente, funcionário e dono) | React com Vite, como PWA. Mesma base de código no celular e na web. [Decidido: React; Vite recomendado, porque o app fica atrás de login e não precisa de renderização no servidor.] |
| Página pública do produto | Site estático separado (por exemplo Astro), para o Google indexar. [Recomendado] |
| Multi-tenant | Um banco, `business_id` em tudo, RLS. |
| SMS | Interface `OtpSender`, provedor a definir. |
| Cobrança | Mercado Pago, assinaturas. |

Detalhes e convenções no `CLAUDE.md`. Tabelas em `DATA_MODEL.md`. Endpoints em `API.md`.

## 9. Modelo de negócio

- Teste grátis de 30 dias, sem cartão. Depois, assinatura mensal pelo Mercado Pago. [Decidido]
- Preço por faixa de visitas registradas por mês. [Premissa: valores e faixas a validar.]

| Plano | Visitas por mês | Preço |
|---|---|---|
| Essencial | até 300 | R$ 39 |
| Profissional | até 800 | R$ 79 |
| Studio | até 2.000 | R$ 149 |
| Grande | até 5.000 | R$ 249 |

- A tarifa do Mercado Pago é de cerca de 3,99% a 4,99% por cobrança, conforme o prazo de repasse.
- O SMS é o principal custo variável: em torno de US$ 0,06 por mensagem no Brasil. Com sessão longa, o cliente costuma receber um SMS no primeiro acesso e outro quando a sessão vence.
- Passar do limite da faixa não bloqueia o balcão; o sistema avisa o dono (RN-PLA-04).
- Sem pagamento, o negócio fica em somente leitura e nenhum dado é apagado (RN-PLA-06).

## 10. Marcos de implementação

Cada marco entrega algo que roda de ponta a ponta e tem testes.

| Marco | Entrega | Pronto quando |
|---|---|---|
| **M0. Fundação** | Monorepo, CI, Postgres com migrações, papéis `app_user` e `app_system`, RLS e testes de isolamento, módulo de configuração, logs. | Os testes de RLS passam e um `GET /v1/health` responde. |
| **M1. Salão e cartões** | Cadastro do salão (`signup`), login de staff, sessões, tela de criar e editar cartões, página pública `/s/<slug>`. | O dono cria um cartão e vê a página pública do salão. |
| **M2. Cliente** | OTP por SMS com limites, primeiro acesso (nome), Início com cartões empilhados, Meu QR renovável com contagem, Perfil, entrar nos cartões do negócio. | Um cliente entra pelo celular e vê o próprio QR mudando a cada 30 s. |
| **M3. Balcão** | Convite de funcionário, leitor de QR, `scan/resolve`, registrar visita com intervalo mínimo, ciclos e idempotência. | Um funcionário registra uma visita lendo o QR de outro celular. |
| **M4. Prêmio e validade** | Conclusão de ciclo, prêmio com validade, resgate, vencimento dos pontos, estorno pelo dono. | Todo o caminho "completa, ganha, resgata, vence" passa nos testes com relógio simulado. |
| **M5. Painel e gestão** | Painel, lista e ficha de clientes, equipe (desativar), edição do negócio, QR do balcão para impressão. | O dono acompanha o dia a dia sem pedir ajuda. |
| **M6. Cobrança** | Assinatura no Mercado Pago, webhooks, estados do plano, somente leitura, tarefas agendadas. | O ciclo teste, assinatura, atraso e somente leitura funciona no sandbox. |
| **M7. Lançamento** | Termos e privacidade, exclusão LGPD, landing estática, monitoramento, backup, endurecimento e piloto. | 3 a 5 salões em uso real. |

## 11. Métricas de sucesso do piloto [Premissa]

- Registrar uma visita leva menos de 10 segundos do abrir o leitor à confirmação.
- Pelo menos 90% das visitas são registradas por QR (não por celular digitado).
- Pelo menos 40% dos clientes cadastrados têm 2 ou mais visitas até o dia 60.
- Pelo menos 30% dos salões do teste assinam depois dos 30 dias.
- Nenhuma ocorrência de dados de um salão aparecendo em outro.

## 12. Riscos

| Risco | Mitigação |
|---|---|
| O cliente precisa entrar no app, o que gera fricção. | NFC e QR no balcão levam direto ao login; sessão longa; nenhuma instalação de loja. |
| Fraude do funcionário (visitas falsas, uso do celular digitado). | Autor e método gravados, intervalo mínimo, estorno só pelo dono, visibilidade no painel. |
| Custo e entregabilidade do SMS. | Limites por número e IP; interface trocável (WhatsApp); só +55. |
| Integração de assinaturas do Mercado Pago. | Webhooks idempotentes, estado conferido na API, testes no sandbox, somente leitura em vez de bloqueio. |
| LGPD (o produto é operador dos dados do salão). | Cláusula de operador, consentimentos, anonimização, revisão jurídica. |
| Partida fria: poucos salões, poucos clientes por salão. | Venda porta a porta; o produto vale para cada salão sozinho (não depende de rede). |
| Uma pessoa só para desenvolver e vender. | Escopo enxuto; adiar tudo que está na fase 2. |

## 13. Decisões em aberto

1. Domínio (o nome Freguês está definido). O endereço entra na etiqueta NFC, e depois de gravada trocar custa caro. Conferir Registro.br e INPI (nome e logo) antes de gravar etiquetas ou imprimir material.
2. Preços e faixas finais.
3. Provedor de SMS.
4. Carência de 7 dias antes do somente leitura.
5. Textos legais (Termos, Privacidade, cláusula de operador).
6. ORM e biblioteca de leitura de QR (recomendações no `CLAUDE.md`).
7. Telas faltantes (seção 6).

## 14. Documentos relacionados

- `BUSINESS_RULES.md`: regras numeradas (`RN-…`).
- `DATA_MODEL.md`: tabelas, RLS e rotinas.
- `API.md`: contrato REST.
- `CLAUDE.md`: instruções de trabalho para o Claude Code.
- Canvas de design: https://claude.ai/artifact/RRiuRmFoAprBpnYkH3UirJ
- Sistema de design: https://claude.ai/artifact/PjZ1yJ3YjVJT5WRFtaF4od

Os dois endereços acima são privados da conta do Tiago. Para o desenvolvimento, use a pasta `docs/design/` do repositório: telas em PNG, fonte das telas e regras do sistema de design, e a logo em `docs/design/logo/` (kit da logo, com o `README.md`).
