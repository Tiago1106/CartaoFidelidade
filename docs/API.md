# API

Contrato REST da versão 1. É a especificação de partida: o Claude Code implementa em NestJS, gera o OpenAPI com `@nestjs/swagger` e deve manter este documento e o OpenAPI de acordo. As regras por trás de cada endpoint estão em `BUSINESS_RULES.md` (`RN-…`) e as tabelas em `DATA_MODEL.md`.

---

## 1. Convenções

- **Base**: `/v1`. JSON em UTF-8. Campos em `camelCase`.
- **Datas**: ISO 8601 em UTC (`2026-10-26T18:40:00Z`). A interface converte para America/Sao_Paulo.
- **Ids**: `uuid`. **Celular**: E.164 (`+5511912345678`). Só `+55` no MVP.
- **Mensagens de erro**: `message` em português do Brasil, pronta para exibir. A interface decide o texto final pelo `code`.
- **Paginação**: por cursor. `?limit=20&cursor=<opaco>`. A resposta traz `{ items, nextCursor }`, e `nextCursor` é `null` no fim.
- **Idempotência**: `POST /v1/staff/stamps` exige o cabeçalho `Idempotency-Key` (uuid gerado pelo app a cada tentativa de usuário). A mesma chave devolve a resposta original; a mesma chave com corpo diferente dá `IDEMPOTENCY_CONFLICT`.
- **Identificação da requisição**: toda resposta traz `X-Request-Id`, repetido no corpo dos erros.
- **Limites de uso**: respostas `429` trazem `Retry-After`.

### Formato de erro

```json
{
  "error": {
    "code": "STAMP_TOO_SOON",
    "message": "A próxima visita deste cliente só pode ser registrada às 15:40.",
    "details": { "nextAllowedAt": "2026-10-26T18:40:00Z" },
    "requestId": "9b1f…"
  }
}
```

### Autenticação

Há dois tipos de usuário, cada um com sua própria família de endpoints de login: **cliente** (`/v1/customer/auth/*`) e **funcionário ou dono** (`/v1/staff/auth/*`).

- **Access token**: JWT de 15 minutos, enviado em `Authorization: Bearer <token>`. Claims: `sub`, `typ` (`customer` ou `staff`), e para staff também `bid` (business id) e `role`. O app guarda o token só em memória.
- **Refresh token**: opaco, em cookie `HttpOnly; Secure; SameSite=Lax`, com `Path` restrito à família (`/v1/customer/auth` ou `/v1/staff/auth`). **Rotaciona a cada uso**; reapresentar um refresh já usado revoga a sessão inteira. Duração: 90 dias para cliente e 30 dias para staff, renovadas a cada uso (RN-AUT-06, RN-AUT-07).
- Em toda requisição de staff o servidor confere se o usuário continua ativo (`is_active`), para que a desativação valha na hora (RN-PER-05).
- O servidor define o contexto de RLS (`app.business_id` ou `app.customer_id`) a partir do token, nunca do corpo da requisição.

### Níveis de acesso usados nas tabelas

`public` (sem login) · `customer` · `staff` (funcionário **ou** dono) · `owner` (só o dono).

### Negócio em modo somente leitura

Quando `billing_status = read_only` (RN-PLA-06), todo `POST`, `PATCH`, `PUT` e `DELETE` em `/v1/staff/*` e `/v1/owner/*` responde `402 BILLING_READ_ONLY`, **exceto**: login, logout, refresh e recuperação de senha, e os endpoints `/v1/owner/billing/*`. As leituras seguem funcionando. Os endpoints do cliente não são afetados.

---

## 2. Códigos de erro

| Código | HTTP | Quando |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Corpo ou parâmetros inválidos. `details.fields` lista os campos. |
| `UNAUTHENTICATED` | 401 | Sem token, ou token inválido. |
| `TOKEN_EXPIRED` | 401 | Access token vencido. O app tenta o refresh. |
| `FORBIDDEN_ROLE` | 403 | O papel do usuário não permite a ação. |
| `STAFF_INACTIVE` | 403 | Funcionário desativado. |
| `NOT_FOUND` | 404 | Recurso inexistente (ou de outro negócio). |
| `RATE_LIMITED` | 429 | Limite de uso excedido. |
| `PHONE_NOT_SUPPORTED` | 422 | Celular fora de +55 ou inválido. |
| `OTP_INVALID` | 400 | Código errado. `details.attemptsLeft`. |
| `OTP_EXPIRED` | 400 | Código vencido, já usado ou invalidado. |
| `OTP_LOCKED` | 423 | Número bloqueado por 15 min. `details.retryAfterSeconds`. |
| `INVALID_CREDENTIALS` | 401 | E-mail ou senha incorretos (sem dizer qual). |
| `EMAIL_TAKEN` | 409 | E-mail já usado. |
| `INVITE_INVALID` | 410 | Convite vencido ou já usado. |
| `QR_INVALID` | 400 | Conteúdo do QR não reconhecido ou assinatura inválida. |
| `QR_EXPIRED` | 410 | Token do QR vencido. A tela pede para o cliente mostrar o QR de novo. |
| `QR_ALREADY_USED` | 409 | Token do QR já consumido. |
| `SCAN_SESSION_INVALID` | 410 | Sessão de leitura vencida, usada ou de outro funcionário. |
| `CUSTOMER_NOT_FOUND` | 404 | Celular digitado não tem conta. |
| `PROGRAM_NOT_ACTIVE` | 409 | Cartão arquivado. |
| `STAMP_TOO_SOON` | 409 | Intervalo mínimo não cumprido. `details.nextAllowedAt`. |
| `PRIZE_NOT_AVAILABLE` | 409 | Prêmio já resgatado ou cancelado. |
| `PRIZE_EXPIRED` | 410 | Prêmio vencido. |
| `REVERSAL_NOT_ALLOWED` | 409 | Estorno recusado (RN-EST-04). |
| `ALREADY_REVERSED` | 409 | A visita já foi estornada. |
| `PROGRAM_LIMIT_REACHED` | 409 | Limite de cartões ativos (RN-CAR-05). |
| `PROGRAM_HAS_HISTORY` | 409 | Cartão com matrículas não pode ser excluído; arquive. |
| `IDEMPOTENCY_CONFLICT` | 409 | Mesma `Idempotency-Key` com corpo diferente. |
| `BILLING_READ_ONLY` | 402 | Negócio em somente leitura. |

---

## 3. Público

| Método e caminho | Acesso | Descrição |
|---|---|---|
| `GET /v1/health` | public | Estado do serviço (para monitoramento). |
| `GET /v1/public/businesses/:slug` | public | Dados da página do salão (`/s/<slug>`). |
| `POST /v1/signup` | public | O dono cria o negócio e a conta. Inicia o teste de 30 dias. |

`GET /v1/public/businesses/:slug` → `200`:

```json
{
  "name": "Barbearia Navalha",
  "slug": "navalha",
  "programs": [
    { "id": "…", "name": "Corte", "stampsRequired": 10, "rewardDescription": "1 corte grátis" }
  ]
}
```

Responde `404` se o slug não existe. Não traz dados de clientes nem de equipe. Pode ser cacheado por alguns minutos.

`POST /v1/signup`:

```json
{ "businessName": "Barbearia Navalha", "ownerName": "Rafael", "email": "rafael@exemplo.com",
  "password": "********", "acceptTerms": true, "termsVersion": "2026-10-01" }
```

→ `201` com `{ accessToken, expiresIn, staff, business }` (como no login de staff) e cookie de refresh. Gera o `slug` a partir do nome (sufixo numérico em caso de conflito) e define `trial_ends_at = agora + 30 dias`. Envia e-mail de confirmação. [Premissa] A confirmação do e-mail não bloqueia nada no MVP; ela serve à recuperação de senha segura.

---

## 4. Cliente: autenticação

| Método e caminho | Acesso | Descrição |
|---|---|---|
| `POST /v1/customer/auth/otp/request` | public | Envia o código por SMS. |
| `POST /v1/customer/auth/otp/verify` | public | Confere o código e abre a sessão. |
| `POST /v1/customer/auth/refresh` | cookie | Renova o access token (rotaciona o refresh). |
| `POST /v1/customer/auth/logout` | cookie | Encerra a sessão. |

`otp/request` — corpo `{ "phone": "+5511912345678" }` → `202 { "retryAfterSeconds": 60 }`. A resposta é a mesma exista ou não conta para o número (RN-AUT-05). Erros: `PHONE_NOT_SUPPORTED`, `RATE_LIMITED` (3 por hora por número, por IP), `OTP_LOCKED`.

`otp/verify` — corpo `{ "phone": "…", "code": "123456" }` → `200`:

```json
{
  "accessToken": "…", "expiresIn": 900,
  "customer": { "id": "…", "phone": "+5511912345678", "name": null, "email": null, "profileComplete": false }
}
```

Cria a conta se o número ainda não existe. `profileComplete = false` leva o app ao primeiro acesso. Erros: `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED`.

---

## 5. Cliente: conta, cartões e QR

Todos com acesso `customer`.

| Método e caminho | Descrição |
|---|---|
| `GET /v1/customer/me` | Dados do cliente. |
| `PATCH /v1/customer/me` | Conclui ou edita o perfil. |
| `POST /v1/customer/businesses/:slug/join` | Entra nos cartões ativos de um salão. |
| `GET /v1/customer/enrollments` | Lista os cartões do cliente (Início). O app também consulta a cada 5 s em primeiro plano para mostrar "Carimbo registrado" e "Cartão completo" (RN-PRE-07). |
| `GET /v1/customer/enrollments/:id` | Detalhe do cartão, com histórico. |
| `POST /v1/customer/qr-token` | Emite o token do QR (renovado a cada 30 s). |
| `PUT /v1/customer/businesses/:businessId/marketing-consent` | Altera o consentimento de marketing de um salão. |
| `DELETE /v1/customer/me` | Pede a exclusão da conta (LGPD). |

`PATCH /v1/customer/me` — corpo `{ "name": "Carlos Mendes", "email": "carlos@exemplo.com", "acceptTerms": true, "termsVersion": "2026-10-01" }`. No primeiro acesso (tela de cadastro) o app envia só `name` e `acceptTerms: true`, porque o aceite acontece ao continuar na tela do celular (RN-ENT-07, RN-ENT-08). `email` é opcional e se edita depois, no Perfil. Todos os campos são editáveis no Perfil, menos o celular.

`POST /v1/customer/businesses/:slug/join` — corpo `{ "marketingOptIn": false, "programIds": ["…"] }`. `programIds` é opcional (padrão: todos os cartões ativos). `marketingOptIn` começa `false` e só vale se o cliente marcou (RN-LGP-03). Cria `business_customers` e as matrículas. Idempotente. → `200 { "enrollments": [ … ] }`.

`GET /v1/customer/enrollments` → `200`:

```json
{
  "items": [
    {
      "id": "…",
      "business": { "id": "…", "name": "Barbearia Navalha", "slug": "navalha" },
      "program": { "id": "…", "name": "Corte", "rewardDescription": "1 corte grátis", "cardColor": "#16181B" },
      "progress": { "current": 7, "required": 10, "cycleNumber": 2, "expiresAt": "2026-11-26T02:59:59Z" },
      "lastStampAt": "2026-10-20T14:10:00Z",
      "availableRedemptions": [
        { "id": "…", "rewardDescription": "1 corte grátis", "expiresAt": "2026-11-12T02:59:59Z" }
      ]
    }
  ]
}
```

`cardColor` é a cor do cartão (hex) e o app escolhe o texto claro ou escuro pelo contraste. O campo "Validade" do cartão usa `progress.expiresAt`; com prêmio disponível, usa `availableRedemptions[].expiresAt`. Se não há ciclo aberto (ciclo vencido ou recém-concluído), `progress.current = 0`, `progress.expiresAt = null` e `required` vem das regras atuais do cartão. O servidor resolve vencimentos antes de responder (`DATA_MODEL.md`, 10.3).

`GET /v1/customer/enrollments/:id` — a mesma estrutura mais `stamps` (visitas do ciclo atual, da mais recente para a mais antiga, cada uma com `number`, `createdAt`, `staffFirstName` e `reversed`; nunca traz o motivo do estorno, RN-PRE-08), `redemptions` (todos os prêmios, com status) e `pastCycles` (ciclos concluídos ou vencidos, com datas).

`POST /v1/customer/qr-token` → `200`:

```json
{ "token": "eyJhbGciOi…", "qrPayload": "lc1.eyJhbGciOi…", "expiresAt": "2026-10-26T18:30:45Z", "renewInSeconds": 30 }
```

- O app desenha `qrPayload` no QR e chama de novo a cada `renewInSeconds`, enquanto está em primeiro plano (RN-QR-02, RN-QR-04). A tela mostra a contagem até a próxima renovação (RN-QR-01).
- O prefixo `lc1.` identifica o formato e a versão para o leitor.
- Limite: 6 chamadas por minuto por cliente. [Premissa]

`PUT …/marketing-consent` — corpo `{ "optIn": true }` → `200`. Registra data e origem (`settings`).

`DELETE /v1/customer/me` — [Premissa] exige reautenticação: o cliente pede um código novo em `otp/request` e envia `{ "code": "123456" }`. → `202`. A anonimização (RN-LGP-04) pode acontecer de forma assíncrona. Revoga todas as sessões.

---

## 6. Funcionário e dono: autenticação

| Método e caminho | Acesso | Descrição |
|---|---|---|
| `POST /v1/staff/auth/login` | public | E-mail e senha. |
| `POST /v1/staff/auth/refresh` | cookie | Renova o access token. |
| `POST /v1/staff/auth/logout` | cookie | Encerra a sessão. |
| `POST /v1/staff/auth/password/forgot` | public | Envia o e-mail de recuperação. Sempre `202`. |
| `POST /v1/staff/auth/password/reset` | public | Define nova senha com o token do e-mail. |
| `POST /v1/staff/auth/invite/accept` | public | Funcionário aceita o convite e define a senha. |
| `POST /v1/staff/auth/verify-email` | public | Confirma o e-mail com o token recebido. |
| `GET /v1/staff/me` | staff | Usuário, papel e estado do negócio. |

`login` — corpo `{ "email": "…", "password": "…" }` → `200`:

```json
{
  "accessToken": "…", "expiresIn": 900,
  "staff": { "id": "…", "name": "Rafael", "role": "owner" },
  "business": { "id": "…", "name": "Barbearia Navalha", "slug": "navalha",
                "billingStatus": "trialing", "accessMode": "full" }
}
```

O app abre o painel quando `role = owner` e o leitor de QR quando `role = employee` (RN-PER-07). `accessMode` é `full` ou `read_only`. Erros: `INVALID_CREDENTIALS`, `STAFF_INACTIVE`, `RATE_LIMITED` (10 tentativas por 15 minutos por e-mail e por IP [Premissa]).

`invite/accept` — corpo `{ "token": "…", "name": "Marina", "password": "********" }` → `200` e já abre a sessão. Erro: `INVITE_INVALID`.

---

## 7. Funcionário e dono: balcão

Acesso `staff` (funcionário ou dono). É o coração do produto.

| Método e caminho | Descrição |
|---|---|
| `GET /v1/staff/programs` | Lista de cartões ativos do negócio. |
| `POST /v1/staff/scan/resolve` | Lê o QR (ou o celular digitado) e abre uma sessão de leitura. |
| `POST /v1/staff/stamps` | Registra +1 visita. |
| `POST /v1/staff/redemptions/:id/redeem` | Resgata um prêmio. |
| `GET /v1/staff/stamps/recent` | Últimas visitas registradas. |

`GET /v1/staff/programs` → `{ "items": [ { "id", "name", "rewardDescription", "stampsRequired", "stampsToday" } ] }`. Alimenta a escolha do cartão quando o negócio tem vários e as telas do dono. O funcionário não passa por uma lista: a tela inicial dele é o leitor (RN-VIS-10).

### 7.1 Ler o cliente

`POST /v1/staff/scan/resolve` — **um** dos dois corpos:

```json
{ "qrPayload": "lc1.eyJhbGciOi…" }
```
```json
{ "phone": "+5511912345678" }
```

→ `200`:

```json
{
  "scanSession": { "id": "…", "expiresAt": "2026-10-26T18:32:30Z" },
  "customer": { "id": "…", "name": "Carlos Mendes", "phoneMasked": "(11) •••••-5678", "isNew": false },
  "programs": [
    {
      "programId": "…", "name": "Corte", "rewardDescription": "1 corte grátis",
      "enrollmentId": "…",
      "progress": { "current": 7, "required": 10 },
      "lastStampAt": "2026-10-20T14:10:00Z",
      "nextAllowedAt": null,
      "canStamp": true,
      "availableRedemptions": []
    },
    {
      "programId": "…", "name": "Barba", "rewardDescription": "1 barba grátis",
      "enrollmentId": "…",
      "progress": { "current": 0, "required": 5 },
      "lastStampAt": "2026-10-20T14:10:00Z",
      "nextAllowedAt": null,
      "canStamp": true,
      "availableRedemptions": [
        { "id": "…", "rewardDescription": "1 barba grátis", "expiresAt": "2026-11-12T02:59:59Z" }
      ]
    }
  ]
}
```

- Com `qrPayload`, **consome** o token (`QR_ALREADY_USED` se repetido, `QR_EXPIRED` se vencido, `QR_INVALID` se não reconhecido).
- Com `phone`, só funciona para número com conta (`CUSTOMER_NOT_FOUND` caso contrário). A sessão fica com `method = phone` (RN-VIS-07).
- `enrollmentId` é `null` quando o cliente ainda não tem matrícula naquele cartão. `isNew` é `true` quando o cliente nunca teve registro neste negócio.
- `canStamp = false` quando o intervalo mínimo não passou (`nextAllowedAt` indica quando). O intervalo é **por cartão**: a interface mostra aquele cartão bloqueado, com "Próximo carimbo às HH:MM", e deixa escolher os outros (RN-VIS-02, RN-VIS-05).
- O celular nunca é devolvido por inteiro (RN-LGP-05).
- A sessão vale 2 minutos e uma única ação (RN-QR-05). Limite: 60 leituras por minuto por funcionário. [Premissa]

### 7.2 Registrar visita

`POST /v1/staff/stamps` — cabeçalho `Idempotency-Key: <uuid>`, corpo:

```json
{ "scanSessionId": "…", "programId": "…" }
```

→ `201`:

```json
{
  "stamp": { "id": "…", "createdAt": "2026-10-26T18:31:02Z", "method": "qr" },
  "progress": { "current": 8, "required": 10, "cycleNumber": 2, "expiresAt": "2026-11-26T02:59:59Z" },
  "prizeUnlocked": null
}
```

Se esta visita completou o cartão, `prizeUnlocked` traz o prêmio liberado:

```json
"prizeUnlocked": { "redemptionId": "…", "rewardDescription": "1 corte grátis", "expiresAt": "2026-11-25T02:59:59Z" }
```

Erros: `SCAN_SESSION_INVALID`, `PROGRAM_NOT_ACTIVE`, `STAMP_TOO_SOON`, `BILLING_READ_ONLY`, `IDEMPOTENCY_CONFLICT`. Regras: RN-VIS-01 a RN-VIS-09. O funcionário que registrou fica gravado no registro (`staff_id`).

### 7.3 Resgatar prêmio

`POST /v1/staff/redemptions/:id/redeem` — corpo `{ "scanSessionId": "…" }` → `200`:

```json
{ "redemption": { "id": "…", "status": "redeemed", "redeemedAt": "2026-10-26T18:35:00Z" } }
```

Erros: `SCAN_SESSION_INVALID`, `PRIZE_NOT_AVAILABLE`, `PRIZE_EXPIRED`, `BILLING_READ_ONLY`.

### 7.4 Últimas visitas

`GET /v1/staff/stamps/recent?limit=20` → itens `{ id, createdAt, customerName, programName, method, reversed }`. O funcionário vê só as próprias; o dono vê as de todos. Serve para conferir um registro recente.

---

## 8. Dono

Acesso `owner`.

### 8.1 Painel

`GET /v1/owner/dashboard?range=today|7d|30d` → `200`:

```json
{
  "range": "7d",
  "stamps": 184,
  "activeCustomers": 96,
  "newCustomers": 12,
  "prizesUnlocked": 9,
  "prizesRedeemed": 7,
  "returningCustomers": 41,
  "stampsByStaff": [ { "staffId": "…", "name": "Rafael", "stamps": 120 }, { "staffId": "…", "name": "Marina", "stamps": 64 } ],
  "usage": { "month": "2026-10", "stamps": 612, "limit": 800 }
}
```

Definições em `DATA_MODEL.md`, seção 11. Estornos não entram na contagem.

### 8.2 Cartões

| Método e caminho | Descrição |
|---|---|
| `GET /v1/owner/programs?status=active\|archived` | Lista os cartões. |
| `POST /v1/owner/programs` | Cria um cartão. |
| `PATCH /v1/owner/programs/:id` | Edita um cartão. |
| `POST /v1/owner/programs/:id/archive` | Arquiva. |
| `POST /v1/owner/programs/:id/unarchive` | Reativa. |
| `DELETE /v1/owner/programs/:id` | Exclui um cartão sem matrículas. |

Corpo de `POST` e `PATCH`:

```json
{ "name": "Corte", "stampsRequired": 10, "rewardDescription": "1 corte grátis",
  "validityDays": 30, "rewardValidityDays": 30, "minIntervalMinutes": 60, "cardColor": "#16181B" }
```

Alterar `stampsRequired`, `rewardDescription` ou os prazos vale só para **ciclos novos** (RN-CAR-04). A resposta de `PATCH` traz `appliesToNewCyclesOnly: true` para a interface avisar o dono. Erros: `PROGRAM_LIMIT_REACHED`, `PROGRAM_HAS_HISTORY`, `VALIDATION_ERROR`.

### 8.3 Clientes e estorno

| Método e caminho | Descrição |
|---|---|
| `GET /v1/owner/customers?q=&cursor=&limit=` | Busca e lista clientes do negócio. |
| `GET /v1/owner/customers/:customerId` | Ficha do cliente. |
| `POST /v1/owner/stamps/:id/reverse` | Estorna uma visita. |

`GET /v1/owner/customers` — itens `{ id, name, phoneMasked, lastStampAt, totalStamps, marketingOptIn }`. A busca `q` aceita nome ou final do celular. Não devolve o celular inteiro.

`GET /v1/owner/customers/:customerId` — traz o celular completo, e-mail, consentimento, matrículas e o histórico de visitas (data, cartão, funcionário, método, estorno e motivo) e de prêmios. **Registra a consulta** no log de auditoria (RN-LGP-05).

`POST /v1/owner/stamps/:id/reverse` — corpo `{ "reason": "Registrada no cliente errado" }` → `200 { "reversal": { "id": "…", "createdAt": "…" }, "progress": { … } }`. Erros: `ALREADY_REVERSED`, `REVERSAL_NOT_ALLOWED`, `VALIDATION_ERROR` (motivo com menos de 3 caracteres).

### 8.4 Equipe

| Método e caminho | Descrição |
|---|---|
| `GET /v1/owner/staff` | Lista funcionários e o dono. |
| `POST /v1/owner/staff` | Convida um funcionário. |
| `PATCH /v1/owner/staff/:id` | Edita o nome. |
| `POST /v1/owner/staff/:id/resend-invite` | Reenvia o convite. |
| `POST /v1/owner/staff/:id/deactivate` | Desativa e revoga as sessões. |
| `POST /v1/owner/staff/:id/reactivate` | Reativa. |

`POST /v1/owner/staff` — corpo `{ "name": "Marina", "email": "marina@exemplo.com" }` → `201`. O papel é sempre `employee`. Envia o convite por e-mail (válido por 7 dias). Erro: `EMAIL_TAKEN`. O dono não pode desativar a si mesmo (`FORBIDDEN_ROLE`).

### 8.5 Negócio

`GET /v1/owner/business` e `PATCH /v1/owner/business` (corpo `{ "name": "…" }`). O `slug` não muda (RN-TEN-05). A resposta de `GET` traz também `publicUrl` e `nfcUrl`, para o dono gravar a etiqueta e imprimir o QR do balcão.

### 8.6 Plano e cobrança

| Método e caminho | Descrição |
|---|---|
| `GET /v1/owner/billing` | Estado, plano, uso e planos disponíveis. |
| `POST /v1/owner/billing/subscribe` | Inicia a assinatura no Mercado Pago. |
| `POST /v1/owner/billing/change-plan` | Troca de plano. |
| `POST /v1/owner/billing/cancel` | Cancela ao fim do período. |

`GET /v1/owner/billing` → `200`:

```json
{
  "billingStatus": "trialing",
  "accessMode": "full",
  "trialEndsAt": "2026-11-25T14:00:00Z",
  "currentPeriodEnd": null,
  "cancelAtPeriodEnd": false,
  "pastDueSince": null,
  "plan": null,
  "usage": { "month": "2026-10", "stamps": 612, "limit": null },
  "plans": [
    { "code": "essencial", "name": "Essencial", "priceCents": 3900, "monthlyStampLimit": 300 },
    { "code": "profissional", "name": "Profissional", "priceCents": 7900, "monthlyStampLimit": 800 },
    { "code": "studio", "name": "Studio", "priceCents": 14900, "monthlyStampLimit": 2000 },
    { "code": "grande", "name": "Grande", "priceCents": 24900, "monthlyStampLimit": 5000 }
  ]
}
```

`subscribe` — corpo `{ "planCode": "profissional" }` → `200 { "checkoutUrl": "https://www.mercadopago.com.br/…" }`. O app redireciona o dono para a página do Mercado Pago. O estado só muda quando o webhook confirma (RN-PLA-09).

---

## 9. Webhook do Mercado Pago

`POST /v1/webhooks/mercadopago` — público, mas com assinatura.

1. Validar o cabeçalho `x-signature` (HMAC com o segredo do webhook) antes de qualquer coisa. Assinatura inválida: `401`, sem processar.
2. Gravar o evento em `billing_events` com `mp_event_id` único. Se já existe, responder `200` e parar.
3. Consultar a API do Mercado Pago pelo estado atual da assinatura (`/preapproval/:id`) ou do pagamento, em vez de confiar só no corpo do webhook.
4. Atualizar `subscriptions` e `businesses`, conforme a tabela:

| Situação no Mercado Pago | `billing_status` | Observação |
|---|---|---|
| Assinatura autorizada e pagamento aprovado | `active` | Atualiza `current_period_end`. Limpa `past_due_since`. |
| Pagamento recusado ou em atraso | `past_due` | Grava `past_due_since`; avisa o dono por e-mail. |
| Assinatura cancelada | `active` até `current_period_end`, depois `read_only` | `cancel_at_period_end = true`. |
| Assinatura pausada | `read_only` | |

5. Responder `200` rápido (processar em fila ou de forma curta).

[Premissa] Os campos e eventos exatos do Mercado Pago devem ser conferidos na documentação oficial na hora da implementação, e o fluxo testado no ambiente de testes (sandbox).

---

## 10. Tarefas agendadas

| Tarefa | Frequência | O que faz |
|---|---|---|
| Fim do teste | Diária | `trialing` com `trial_ends_at` vencido e sem assinatura vira `read_only`. |
| Fim da carência | Diária | `past_due` há mais de 7 dias vira `read_only`. |
| Cancelamento | Diária | Assinaturas com `cancel_at_period_end` e período vencido viram `read_only`. |
| Limpeza | Diária | Remove OTPs, tokens de QR, sessões de leitura e sessões expiradas (`DATA_MODEL.md`, seção 7). |
| Aviso de fim do teste | Diária | E-mail ao dono 7 e 1 dia antes de `trial_ends_at`. [Premissa] |

---

## 11. Limites de uso (resumo)

| Alvo | Limite |
|---|---|
| `otp/request` | 3 por hora por número; 20 por hora por IP |
| `otp/verify` | 5 tentativas por código; depois, bloqueio de 15 min |
| `staff/auth/login` | 10 por 15 minutos por e-mail e por IP |
| `customer/qr-token` | 6 por minuto por cliente |
| `staff/scan/resolve` | 60 por minuto por funcionário |
| `staff/stamps` | 60 por minuto por funcionário |

Armazenamento dos contadores: memória do processo no MVP (uma instância); trocar por armazenamento compartilhado (Redis) antes de rodar mais de uma instância.

---

## 12. Fora desta versão

Listagem do log de auditoria na interface; exportação de dados do cliente; endpoints do feed de lojas; carteiras Apple e Google; envio de mensagens de marketing; relatórios avançados; sincronização offline.
