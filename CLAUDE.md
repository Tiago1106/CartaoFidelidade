# CLAUDE.md

Instruções de trabalho para o Claude Code neste repositório. Este arquivo fica na raiz. Os documentos ficam em `docs/`, as telas em `docs/design/screens/` e a logo em `docs/design/logo/`.

## Idioma (regra do projeto)

**Tudo em inglês**: código, variáveis, nomes de arquivos e pastas, rotas, tabelas e campos, mensagens de commit, comentários e nomes dos documentos. **Só o texto que aparece na tela para o usuário final é em português do Brasil** (e as mensagens de erro e e-mails enviados a pessoas). Esse texto fica em arquivos de mensagens (`apps/web/src/messages/pt-BR.ts`, com chaves em inglês), nunca solto no código. A conversa com o Tiago é em português do Brasil. Os arquivos `docs/design/screens/*.dc.html` mantêm os nomes originais em português porque são a fonte do desenho (somente leitura). Veja `docs/DECISIONS.md`, D-007 e D-009.

## O que é o projeto

PWA de cartão de fidelidade para salões e barbearias. O produto se chama **Freguês** (slogan: "Quem volta, ganha."). O cliente entra pelo celular (SMS) e mostra um QR Code que renova sozinho. O funcionário lê o QR depois do pagamento e registra +1 visita. O dono cria os cartões, gerencia a equipe e acompanha um painel. Multi-tenant, cobrado por assinatura (Mercado Pago).

O Tiago é desenvolvedor full stack sênior, com TypeScript como stack principal. Fale em português do Brasil.

## Leia antes de codar

Em `docs/`, nesta ordem:

1. `PRD.md`: o que construir, para quem, escopo do MVP e os marcos M0 a M7.
2. `BUSINESS_RULES.md`: regras numeradas (`RN-…`). **É a fonte da verdade do comportamento.**
3. `DATA_MODEL.md`: tabelas, RLS e as rotinas de visita, estorno, vencimento e resgate.
4. `API.md`: contrato REST `/v1`.

Se um documento e o código divergem, pare e pergunte. Não "conserte" a regra no código. Quando uma decisão mudar, atualize o documento no mesmo commit.

## Stack

Escolhas de partida. Troque só com justificativa curta registrada em `docs/DECISIONS.md`.

| Área | Escolha |
|---|---|
| Monorepo | pnpm workspaces. `apps/api` (NestJS), `apps/web` (React + Vite, o PWA), `apps/landing` (Astro, estático), `packages/shared` (tipos, esquemas Zod e constantes). |
| Linguagem | TypeScript com `strict`. Node LTS. |
| API | NestJS, REST em `/v1`, validação com Zod (por exemplo `nestjs-zod`), OpenAPI com `@nestjs/swagger`. |
| Banco | Postgres 16 ou superior. Migrações versionadas. |
| Acesso a dados | **Kysely** com `kysely-codegen`, migrações em SQL puro (D-001 em `docs/DECISIONS.md`). |
| Autenticação | JWT de acesso (biblioteca `jose`), refresh opaco em cookie `HttpOnly`, senhas com Argon2id. |
| Web | React, React Router, TanStack Query, Tailwind CSS, shadcn/ui (Radix), `vite-plugin-pwa`. |
| QR | Desenho: biblioteca `qrcode`. Leitura: `BarcodeDetector` quando existir, com `@zxing/browser` ou `jsqr` como alternativa. |
| Testes | Vitest (ou Jest), banco real em contêiner (Testcontainers) para testes de integração, Playwright para os fluxos principais. |
| Qualidade | ESLint, Prettier, `tsc --noEmit` e testes no CI. |

## Regras de ouro (não quebrar)

1. **Isolamento por tenant.** Toda tabela de negócio tem `business_id` e RLS ligada (`ENABLE` e `FORCE`). A requisição usa o papel `app_user` e define o contexto com `SET LOCAL` dentro da transação. Nunca monte filtros de tenant só no código da aplicação. O papel `app_system` (que ignora RLS) fica em um módulo pequeno e isolado.
2. **`stamps` só cresce.** Nada de `UPDATE` ou `DELETE` em visitas. Estorno é uma linha nova (`type = 'reversal'`). O banco garante isso com gatilho.
3. **Nunca apague dado por inadimplência.** O estado do negócio (`read_only`) só bloqueia ações. Veja RN-PLA-06.
4. **Ciclos guardam as regras.** Ao criar um ciclo, copie as regras do cartão. Mudar o cartão não pode alterar um ciclo existente (RN-CAR-04).
5. **Operações de domínio são transacionais e com bloqueio de linha.** Registrar visita, resgatar e estornar seguem os passos de `DATA_MODEL.md`, seção 10, com `SELECT … FOR UPDATE` na matrícula ou no prêmio.
6. **Tempo.** Guarde tudo em UTC (`timestamptz`). Calcule "fim do dia" e datas de vencimento no fuso America/Sao_Paulo. **Nunca** chame `new Date()` ou `now()` solto na regra: injete um relógio (`Clock`), para testar com tempo simulado.
7. **Dinheiro em centavos** (inteiros). Nunca ponto flutuante.
8. **Segredos e dados pessoais.** Nada de segredo no repositório. Nunca registre em log: códigos de SMS, tokens de QR, tokens de refresh, senhas, celular completo.
9. **Tokens sempre com hash.** Código OTP, refresh, convites e recuperação de senha são guardados só como hash.
10. **QR de uso único.** O token do QR é consumido no `scan/resolve`. A visita e o resgate usam a sessão de leitura (`scan_session`), uma ação por sessão.
11. **Idempotência** em `POST /v1/staff/stamps` (`Idempotency-Key`).
12. **Somente leitura** é aplicado por uma guarda central (RN-PLA-06, `API.md`), não em cada endpoint.
13. **Papéis.** O funcionário nunca acessa rotas `/v1/owner/*`. Teste isso.
14. **Não invente regra.** Se algo não está nos documentos, escolha o mais simples, marque como `[Premissa]` no documento e avise o Tiago.

## Convenções

- **Idioma**: veja a seção "Idioma" no topo. Inglês para tudo que é código e estrutura; português do Brasil só para o que o usuário final lê, centralizado em módulos de mensagens.
- **Erros**: formato e códigos de `API.md`, seção 1 e 2. Cada código tem teste.
- **Commits**: em inglês, Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), pequenos e focados. Cite a regra quando houver (`feat(stamps): intervalo mínimo (RN-VIS-05)`).
- **Testes de regra** levam o código da regra no nome: `it('RN-VAL-02: ciclo vencido perde os pontos', …)`.
- **Migrações**: uma por mudança, nunca editar uma já aplicada.
- **Dependências**: acrescente só com motivo. Prefira o que a stack acima já traz.
- **Fase 2**: não implemente nada da lista "fora do escopo" (PRD, seção 5.2) sem pedir.

## Testes obrigatórios (por marco)

- **RLS (M0)**: com o contexto do negócio A, nada do B aparece; sem contexto, nenhuma linha; `INSERT` com `business_id` alheio falha; `UPDATE` e `DELETE` em `stamps` falham.
- **OTP (M2)**: 5 tentativas por código; 3 envios por hora por número; bloqueio de 15 minutos; código usado uma vez só; resposta igual para número novo e existente.
- **QR (M2, M3)**: token expira em 45 s; uso único; `qr-token` renova; leitura com token vencido ou repetido falha.
- **Visita (M3)**: intervalo mínimo; idempotência; criação de matrícula na primeira visita; sessão de leitura vencida; método `phone`.
- **Ciclo e validade (M4)**, **com relógio simulado**: vencimento conta da última visita; ciclo vencido perde os pontos e nada é apagado; novo ciclo copia regras novas e o antigo mantém as antigas; prêmio gerado ao completar; prêmio vence; resgate.
- **Estorno (M4)**: só o dono; motivo obrigatório; estorno duplo recusado; ciclo reaberto quando o prêmio ainda está disponível; recusado quando o prêmio foi resgatado ou há ciclo posterior.
- **Papéis (M3, M5)**: matriz de permissões de `BUSINESS_RULES.md`, seção 3.
- **Cobrança (M6)**: webhook idempotente, assinatura do webhook inválida, transições de estado, somente leitura bloqueia as escritas certas e não bloqueia login e cobrança.

## Comandos

A definir no M0 e registrar aqui. Scripts esperados na raiz: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm db:migrate`, `pnpm db:seed`.

## Variáveis de ambiente (lista de partida)

`DATABASE_URL` (papel `app_user`), `DATABASE_URL_SYSTEM` (papel `app_system`), `JWT_SECRET`, `COOKIE_SECRET`, `APP_URL`, `API_URL`, `SMS_PROVIDER` e credenciais do provedor, `EMAIL_FROM` e credenciais de e-mail, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `QR_TOKEN_SECRET`, `SENTRY_DSN`. Mantenha um `.env.example` sem valores reais.

## Interface e sistema de design

- Tema **só claro**. Cor primária âmbar. Fonte **Manrope**. Base shadcn/ui.
- Texto âmbar sobre fundo claro usa `primary-ink`, nunca `primary` (o âmbar puro mal contrasta com o fundo claro). Estado nunca só por cor: sempre texto ou ícone.
- Alvos de toque de pelo menos 44 px (botões e campos principais: 56 px no celular, 52 px no painel web). Anel de foco sólido de 2 px (`ring`).
- Bordas em vez de sombras. Cartões `20px`, painéis `24px`, controles `12px`. Exceção: os cartões empilhados da carteira do cliente usam uma sombra suave no topo (`0 -2px 10px rgba(22,24,27,.14)`) para separar uma camada da outra.
- O funcionário abre direto no **leitor de QR** (a tela inicial dele). Nas telas do dono (painel, cartões e clientes) o botão de ler QR Code aparece sempre no topo.
- Navegação do **cliente**: barra inferior com três abas (Cartões, Meu QR, Perfil). A aba "Meu QR" tem destaque âmbar.
- Navegação do **dono**: barra inferior com cinco abas (Painel, Cartões, Clientes, Equipe, Plano). Telas de detalhe (ficha do cliente, configurar cartão, QR do balcão) saem da barra e têm botão voltar. Ações (convidar, estornar) abrem folhas com X no canto.
- Folhas (bottom sheets) fecham com o botão X no canto superior direito, nunca com um botão "Fechar" embaixo.
- O QR sempre mostra a contagem de renovação (barra de 6 px e texto "Renova em 0:NN"), com `role="progressbar"`.
- Carimbos marcados usam o **selo do Freguês com as cores invertidas** (corpo `primary`, F escuro). Os vazios são círculos tracejados.
- Texto do cartão (claro ou escuro) é escolhido pelo contraste com `program.cardColor`. Texto para o cliente evita a palavra "salão" quando fala de forma geral.
- **Marca.** O nome é **Freguês**, sempre com acento nos textos. Em domínio, endereços e `slug`, sem acento (`fregues`). A logo é um selo de carimbo com a letra F, em `docs/design/logo/` (SVGs, ícones do PWA, favicon e um `README.md` com o `manifest` pronto). Use `icon-maskable-512.png` como ícone `maskable` e `favicon.svg` como favicon. Fundo claro ou âmbar: marca colorida. Fundo escuro: versão `sobre-escuro`. A tela de boas-vindas usa a versão vertical com slogan.

Variáveis CSS (valores em hex), para `apps/web/src/index.css`:

```css
:root {
  --background: #F7F6F2;           --foreground: #16181B;
  --card: #FFFFFF;                 --card-foreground: #16181B;
  --popover: #FFFFFF;              --popover-foreground: #16181B;
  --primary: #F2B84B;              --primary-foreground: #1A1305;
  --primary-ink: #8A5A00;
  --secondary: #F0EDE5;            --secondary-foreground: #16181B;
  --muted: #F0EDE5;                --muted-foreground: #5B6068;
  --accent: #FBEFD3;               --accent-foreground: #3D2E0B;
  --destructive: #B3261E;          --destructive-foreground: #FFFFFF;
  --success: #1F6B45;              --success-foreground: #FFFFFF;
  --border: #E2DED3;               --input: #8C8678;
  --ring: #16181B;
  --viewfinder: #0B0C0E;           --viewfinder-foreground: #F7F6F2;
  --radius: 12px;  --radius-card: 20px;  --radius-panel: 24px;  --radius-bar: 4px;
}

@theme inline {
  --color-background: var(--background);   --color-foreground: var(--foreground);
  --color-card: var(--card);               --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);         --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);         --color-primary-foreground: var(--primary-foreground);
  --color-primary-ink: var(--primary-ink);
  --color-secondary: var(--secondary);     --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);             --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);           --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive); --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);         --color-success-foreground: var(--success-foreground);
  --color-border: var(--border);           --color-input: var(--input);
  --color-ring: var(--ring);
  --color-viewfinder: var(--viewfinder);   --color-viewfinder-foreground: var(--viewfinder-foreground);
  --radius-lg: var(--radius);  --radius-card: var(--radius-card);  --radius-panel: var(--radius-panel);
  --font-sans: "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

Escala de tipos (tamanho, altura de linha, peso):

| Nome | Valores | Uso |
|---|---|---|
| `display` | 38/42, 800, -0.8px | Boas-vindas |
| `title-1` | 32/37, 800 | Título de tela |
| `title-2` | 24/30, 800 | Seção |
| `title-3` | 18/24, 700 | Bloco e item de lista |
| `metric` | 36/40, 800, números tabulares | Números do painel |
| `body-lg` / `body` / `body-sm` | 17/26, 16/24, 15/22, 400 | Texto |
| `caption` / `micro` | 14/20, 13/19, 400 | Legendas e avisos |
| `label` | 14/20, 600 | Rótulo de campo |
| `button` | 17/24, 700 | Botões |
| `overline` | 12/16, 700, caixa-alta, 0.6px | Rótulos curtos |

Componentes de partida: os do shadcn/ui (Button, Input, Label, Checkbox, RadioGroup, Select, Badge, Avatar, Progress, Table, Alert) mais os compostos do produto. Os componentes do desenho (arquivos `.dc.html` em `docs/design/screens/`, em português) correspondem a estes nomes no código:

| Desenho | Código | Notas |
|---|---|---|
| `Botao` | `Button` | `primary`, `secondary`, `ghost`; tamanhos `large` (56) e `small` (44); `disabled`. |
| `BotaoIcone` | `IconButton` | Alvo de 44 px com círculo de 32 px. Ícones: `x`, `arrowLeft`, `user`. |
| `Pontos` | `StepDots` | Indicador do onboarding (ativo é uma pílula). |
| `Selo` | `StampSeal` | `variant="normal" \| "inverted"`. O invertido é o carimbo marcado do cartão. |
| `Icone` | `Icon` | Use `lucide-react`: `user`, `scissors`, `chevron-right`, `qr-code`, `star`, `heart`, `gift`, `sparkles`, `smartphone`, `trophy`, `circle-check`, `check`, `x`, `arrow-left`, `ticket`, `clock`, `bar-chart`, `users`, `credit-card`, `search`. |
| `Ilustracao` | `OnboardingArt` | Fundo âmbar claro com padrão de ícones. |
| `Campo` | `TextField` | Tipos `tel`, `text`, `email`, `password`, `number`; estados `default`, `focus`, `error`; prefixo opcional (+55), sufixo opcional ("dias", "minutos"), ícone à esquerda e rótulo opcional (campo de busca). |
| `Codigo` | `OtpInput` | Seis caixas, `autocomplete="one-time-code"`. |
| `CartaoFidelidade` | `ProgramCard` | Props: nome, subtítulo, carimbos atuais e total, validade, `cardColor`. Estado "completo" mostra a etiqueta "Prêmio". `joined` liga o cartão ao QR (cantos de baixo retos). |
| `BarraAbas` | `BottomNav` | `modo="cliente"`: Cartões, Meu QR, Perfil. `modo="dono"`: Painel, Cartões, Clientes, Equipe, Plano. |
| `LinhaMenu` | `MenuRow` | Rótulo, valor e seta; sem seta quando só leitura. |
| `OpcaoCartao` | `RadioCard` | Estados `selected`, `normal` e `blocked` (cartão em intervalo). Também usado para escolher o plano. |
| `Segmentado` | `Tabs` / `SegmentedControl` | Opções separadas por `\|`, uma ativa. Período do painel e filtros de lista. |
| `Indicador` | `StatTile` | Rótulo e valor grande (KPI do painel). |
| `LinhaBarra` | `ProgressRow` | Nome, valor e barra de progresso (`Progress`). |
| `LinhaCartao` | `ProgramListItem` | Amostra de cor com o selo, nome, resumo, clientes e estado (Ativo/Arquivado). |
| `LinhaCliente` | `CustomerListItem` | Iniciais, nome, última visita e etiqueta "Prêmio". |
| `LinhaFuncionario` | `StaffListItem` | Iniciais, nome, detalhe e estado (Ativo, Convite pendente, Inativo). |
| `LinhaHistorico` | `HistoryRow` | Título, data, funcionário e ação "Estornar" (só dono, só na visita mais recente) ou etiqueta "Estornada". |
| `SeletorCor` | `ColorPicker` | `radiogroup` com 8 cores fixas e check de contraste (texto claro ou escuro). Cor vai para `programs.card_color`. |

O QR (`QrCard`) e a grade de carimbos (`StampGrid`, 2 linhas de 5) são compostos dentro de `ProgramCard` e das telas Meu QR e Início. Os arquivos do desenho trazem os valores exatos de espaçamento, cores e textos de cada tela.

## Como trabalhar

O desenvolvimento é **lento e aprovado por partes**. O Tiago aprova cada tarefa antes de ela contar como concluída.

1. O guia é `docs/TASK_PLAN.md`: uma tarefa por vez, com estados `Pending`, `In progress`, `In review`, `Adjusting` e `Done`. No máximo uma tarefa fica aberta. **Nunca marque `Done` sem a aprovação do Tiago e nunca comece a próxima tarefa antes dela.**
2. Use as skills do projeto (em `.claude/skills/`):
   - `approval-workflow`: como pegar, executar, entregar e fechar uma tarefa. Use em toda tarefa.
   - `implement-screen`: como construir uma tela a partir do arquivo de desenho.
   - `design-system-component`: como construir um componente com story no Storybook.
   - `api-module`: como construir uma funcionalidade do backend (migração, RLS, serviço, testes).
3. Trabalhe em uma branch por tarefa (`task/T05-text-field`), nunca na `main`. Integre na `main` só depois da aprovação.
4. Antes de começar uma tarefa, escreva em poucas linhas o que vai fazer e quais regras `RN-…` cobre.
5. Faça a migração e o teste de RLS **antes** do código de cada tabela nova.
6. Ao terminar, entregue no formato da skill `approval-workflow` (o que ficou pronto, como ver, evidências, comparação com o desenho, o que ficou de fora e `[Premissa]` novas) e **pare e espere**.
7. Pergunte quando uma decisão de produto não estiver nos documentos. Não pergunte sobre detalhes técnicos que a stack acima já resolve.
8. Registre decisões técnicas novas em `docs/DECISIONS.md`.
