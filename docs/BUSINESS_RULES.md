# Regras de negócio

Documento de referência para o desenvolvimento. Cada regra tem um código (`RN-…`) para ser citada em código, testes e commits.

Convenção das marcas:

- **[Decidido]**: definido pelo Tiago nas conversas de produto.
- **[Premissa]**: valor ou comportamento que o documento assumiu para fechar uma lacuna. Deve ser revisado antes de ir para produção.

Os nomes de tabelas, campos e endpoints (em inglês) estão em `DATA_MODEL.md` e `API.md`. Textos que o usuário final lê ficam em português do Brasil.

---

## 1. Glossário

| Termo | Significado |
|---|---|
| Negócio | Um salão ou barbearia que assina o produto. É o tenant. Uma unidade por negócio. |
| Dono | Usuário administrador do negócio (`owner`). |
| Funcionário | Usuário do negócio com login próprio (`employee`), que registra visitas. |
| Cliente | Pessoa final, identificada pelo celular. Conta global, com cartões em vários negócios. |
| Cartão (programa) | Regra de fidelidade criada pelo negócio: "10 cortes = 1 grátis". Um negócio pode ter mais de um cartão ativo. |
| Matrícula (enrollment) | Participação de um cliente em um cartão. |
| Visita ou carimbo (stamp) | Registro de +1 em uma matrícula. Aparece como "visita" na interface. |
| Ciclo | Uma volta do cartão, do primeiro carimbo até completar ou vencer. Guarda uma cópia das regras vigentes quando começou. |
| Prêmio (redemption) | Recompensa gerada quando um ciclo se completa. Tem validade própria. |
| Estorno | Anulação de uma visita registrada por engano. Só o dono faz. |

---

## 2. Negócios e isolamento

- **RN-TEN-01** [Decidido] Cada negócio tem uma única unidade. Não há multi-unidade no MVP.
- **RN-TEN-02** Todo dado de um negócio é isolado por `business_id` e protegido por Row Level Security no Postgres. Nenhuma consulta de negócio pode atravessar tenants.
- **RN-TEN-03** O cliente é global. Um celular corresponde a uma conta, com cartões em vários negócios. Um negócio só enxerga clientes que têm matrícula ou visita nele.
- **RN-TEN-04** [Decidido] O salão se cadastra sozinho pelo site. A venda porta a porta acontece fora do produto e não exige tela interna.
- **RN-TEN-05** Cada negócio tem um `slug` público e único, que forma o endereço `/s/<slug>` gravado no NFC e impresso no QR do balcão. [Premissa] O slug é gerado a partir do nome e não pode ser alterado pelo dono, porque mudar quebraria as etiquetas já distribuídas.
- **RN-TEN-06** Dados nunca são apagados por inadimplência ou cancelamento. Veja RN-PLA-06.

---

## 3. Papéis e permissões

- **RN-PER-01** [Decidido] Existe um dono por negócio. O dono cadastra funcionários. Outros administradores ficam para depois.
- **RN-PER-02** O funcionário é cadastrado pelo dono, por convite de e-mail, com nome, e-mail e senha. O funcionário aceita o convite e define a própria senha.
- **RN-PER-03** [Decidido] Todos os usuários do negócio (dono e funcionário) acessam a lista de cartões ativos, o leitor de QR Code, o registro de visita e o resgate de prêmio.
- **RN-PER-04** [Decidido] Somente o dono acessa painel, clientes, equipe, plano, configuração de cartões e estorno.

| Ação | Cliente | Funcionário | Dono |
|---|---|---|---|
| Ver os próprios cartões e mostrar QR | sim | n/a | n/a |
| Ver lista de cartões ativos do negócio | n/a | sim | sim |
| Ler QR, registrar visita, resgatar prêmio | n/a | sim | sim |
| Estornar visita | n/a | não | sim |
| Criar, editar e arquivar cartões | n/a | não | sim |
| Painel, lista de clientes, histórico de cliente | n/a | não | sim |
| Equipe: convidar, desativar | n/a | não | sim |
| Plano e cobrança | n/a | não | sim |

- **RN-PER-05** Ao desativar um funcionário, todas as sessões dele são revogadas na hora e o login é bloqueado. O histórico de visitas continua com o nome dele.
- **RN-PER-06** O funcionário não pode se auto-promover nem alterar o próprio papel. [Premissa] Nem o dono pode se desativar.
- **RN-PER-07** Ao entrar, o dono abre no painel e o funcionário abre direto no leitor de QR (RN-VIS-10).

---

## 4. Cartões (programas)

- **RN-CAR-01** [Decidido] Quem cadastra a recompensa é o negócio, em texto livre ("1 corte grátis").
- **RN-CAR-02** [Decidido] Um negócio pode ter mais de um cartão ativo ao mesmo tempo, e um cliente pode participar de todos.
- **RN-CAR-03** Parâmetros de um cartão:
  - `name`: nome do cartão (por exemplo "Corte").
  - `stamps_required`: visitas para completar, de 2 a 30. [Premissa]
  - `reward_description`: texto da recompensa.
  - `validity_days`: dias sem pontuar até os pontos vencerem. [Decidido que é configurável]
  - `reward_validity_days`: dias de validade do prêmio depois de completo. [Decidido que existe]
  - `min_interval_minutes`: intervalo mínimo entre duas visitas do mesmo cliente no mesmo cartão. [Decidido que existe]
  - `card_color`: cor do cartão na carteira do cliente (hex). Vale imediatamente. [Decidido que existe; a escolha na tela do dono ainda não foi desenhada]
- **RN-CAR-04** [Decidido] Mudar `stamps_required`, `reward_description` ou os prazos de validade vale só para ciclos novos. Cada ciclo guarda uma cópia das regras de quando começou (veja RN-CIC-02). Mudar `name` vale imediatamente. `min_interval_minutes` é uma regra antiabuso e vale imediatamente.
- **RN-CAR-05** [Premissa] Um negócio pode ter até 5 cartões ativos (parâmetro de configuração).
- **RN-CAR-06** Um cartão com histórico nunca é excluído; ele é arquivado. [Decidido] Um cartão arquivado não recebe visitas novas e some da lista do cliente, mas prêmios já disponíveis continuam resgatáveis até vencer. Só se exclui de fato um cartão sem nenhuma matrícula.
- **RN-CAR-07** Valores de partida sugeridos na criação: 10 visitas, 30 dias de validade dos pontos, 30 dias de validade do prêmio, 60 minutos de intervalo mínimo. [Premissa]

---

## 5. Entrada do cliente

- **RN-ENT-01** [Decidido] O cliente chega ao salão e encosta o celular na etiqueta NFC (ou lê o QR impresso). A etiqueta tem uma URL fixa, `/s/<slug>`.
- **RN-ENT-02** A página `/s/<slug>` (tela 00) mostra o nome do salão e os cartões ativos em prévia, com o botão "Entrar com meu celular". Se o cliente não estiver logado, segue para o login por celular; se já estiver, vai direto para o Início.
- **RN-ENT-03** [Decidido] O login do cliente usa só o celular, com código por SMS. As iniciais do nome servem de foto.
- **RN-ENT-07** [Decidido] A tela de cadastro ("Como podemos te chamar?") aparece **só no primeiro acesso**, depois do código SMS de uma conta nova, e pede apenas o nome. Quem já tem conta vai direto ao Início. O e-mail é opcional e se edita depois, no Perfil. O texto da tela é neutro ("É assim que você aparece para quem te atende"), sem citar "salão", porque o produto serve a vários tipos de negócio.
- **RN-ENT-08** [Decidido] O aceite dos Termos e da Política (RN-LGP-02) acontece ao continuar na tela do celular ("Ao continuar, você aceita…"). O app envia `acceptTerms` junto do cadastro do nome.
- **RN-ENT-04** Depois do login, o cliente entra nos cartões ativos do salão (cria as matrículas). Também é possível a matrícula ser criada na primeira visita registrada pelo funcionário (RN-VIS-06).
- **RN-ENT-05** [Decidido] O cliente é identificado por um QR Code único, não por cartão ou por serviço. Um QR vale para todos os cartões em todos os negócios.
- **RN-ENT-06** [Decidido] O feed de lojas e as carteiras Apple e Google ficam para a fase 2. A interface do cliente só **imita** o visual de carteira (cartões empilhados).
- **RN-ENT-09** [Decidido] O QR do cliente é acessível **sem depender de cartão**, pela aba "Meu QR". É assim que um cliente novo, ou um cliente num negócio novo sem etiqueta NFC, começa um cartão: o funcionário lê o QR e a matrícula nasce na primeira visita (RN-VIS-06). Quem ainda não tem nenhum cartão vê um Início vazio com o botão "Mostrar meu QR Code".
- **RN-ENT-10** [Decidido] Navegação do cliente: três abas, **Cartões**, **Meu QR** e **Perfil**.

---

## 6. QR Code

Objetivo: o QR mostrado na tela não pode ser copiado ou fotografado e reutilizado depois.

- **RN-QR-01** [Decidido] O QR do cliente é renovado automaticamente a cada 30 segundos, e a tela **mostra o tempo restante**: uma barra de progresso e o texto "Renova em 0:24". (Decisão revista: antes era sem contagem na tela.) A contagem aparece na tela Meu QR e no QR do cartão aberto no Início.
- **RN-QR-02** O QR carrega um token assinado e de uso único, emitido pelo servidor, com validade de 45 segundos. O app pede um token novo aos 30 segundos, com margem de 15 segundos. Se não conseguir renovar, esconde o QR e mostra "Reconectando…".
- **RN-QR-03** O token é consumido quando o funcionário o lê (`scan/resolve`). Reutilizar o mesmo token falha com `QR_ALREADY_USED`; token vencido falha com `QR_EXPIRED`.
- **RN-QR-04** O servidor só emite token com a sessão do cliente válida e o app em primeiro plano. O app para de renovar quando fica em segundo plano.
- **RN-QR-05** Ao ler o QR, o servidor abre uma sessão de leitura (`scan_session`) ligada ao funcionário, ao cliente e ao negócio, com validade de 2 minutos e uso único. A sessão dá tempo para o funcionário escolher o cartão sem pressa. Cada sessão serve a uma única ação (registrar visita ou resgatar prêmio), e essa ação usa a sessão, não o token do QR.
- **RN-QR-06** O QR não tem regra específica por plataforma. Mostrar o QR e lê-lo funcionam em qualquer aparelho, porque a segurança está no token de uso único, não no dispositivo. [Decidido que a detecção de web é indiferente]
- **RN-QR-07** [Premissa] Nesta versão o token vem do servidor. Uma evolução possível (fase 2) é gerar o token no aparelho com HMAC/TOTP e chave não exportável (WebCrypto), para reduzir a dependência de rede.

---

## 7. Registrar visita

Fluxo do funcionário: abre o leitor, lê o QR, vê o cliente, escolhe o cartão e confirma.

- **RN-VIS-01** [Decidido] Cada leitura confirmada registra +1 visita em um cartão. O registro guarda quem registrou (funcionário), quando, em qual cartão, e o método (`qr` ou `phone`).
- **RN-VIS-02** [Decidido] Depois de ler o QR, a tela mostra nome do cliente, celular parcialmente oculto e os cartões ativos com o progresso. Se houver um único cartão ativo, o funcionário só confirma. Com mais de um, escolhe. Um cartão em intervalo mínimo aparece **bloqueado**, com "Próximo carimbo às HH:MM", e não pode ser escolhido.
- **RN-VIS-03** A visita só é registrada se: a sessão de leitura está válida, o negócio está com acesso total (RN-PLA-05), o cartão está ativo e o intervalo mínimo foi respeitado (RN-VIS-05).
- **RN-VIS-04** O registro é idempotente: o app do funcionário envia uma `Idempotency-Key` e repetir a mesma chave devolve o mesmo resultado, sem somar de novo. A sessão de leitura também só vale uma vez.
- **RN-VIS-05** [Decidido] Intervalo mínimo: se a última visita não estornada do cliente naquele cartão foi há menos de `min_interval_minutes`, o registro é recusado com `STAMP_TOO_SOON` e a tela diz quando a próxima será possível. O intervalo vale **por cartão**: outro cartão do mesmo cliente registra normalmente. Não há exceção pelo funcionário. A tela "Visita muito recente" aparece quando o único cartão está em intervalo ou quando a leitura chega em cima da hora, e diz a que horas aquele cartão volta a aceitar visitas. Se o bloqueio for indevido, o dono pode estornar a visita anterior (RN-EST-01).
- **RN-VIS-06** Se o cliente ainda não tem matrícula no cartão escolhido, ela é criada na hora da visita.
- **RN-VIS-07** [Decidido] Alternativa quando o QR não funciona (celular sem bateria ou tela quebrada): o funcionário digita o celular do cliente. O sistema só aceita se esse celular tem conta (que provou a posse do número por SMS). A tela mostra o mesmo nome e as mesmas informações. O método fica registrado como `phone` e aparece no histórico para o dono. [Premissa] Não há limite extra de uso do método `phone` no MVP, só o intervalo mínimo e a visibilidade para o dono.
- **RN-VIS-08** [Decidido] O funcionário precisa de internet para registrar. A fila offline fica para a fase 2.
- **RN-VIS-09** Ao completar o último carimbo, o ciclo fecha e o prêmio é gerado (RN-PRE-01). A resposta da visita já informa que o prêmio foi liberado.
- **RN-VIS-10** [Decidido] O funcionário abre o app direto no **leitor de QR**, sem lista de cartões. Depois de registrar, a tela "Visita registrada!" tem o botão "Ler próximo cliente", que volta ao leitor.
- **RN-VIS-11** [Premissa] Se o cliente lido tem um prêmio disponível, a folha de resgate vem primeiro (RN-PRE-03, RN-PRE-04) e o registro da visita segue depois.

---

## 8. Ciclos e validade

- **RN-CIC-01** Um ciclo começa na primeira visita da matrícula (ou na primeira visita após o ciclo anterior terminar). Ele termina por **conclusão** (atingiu `stamps_required`) ou por **vencimento**.
- **RN-CIC-02** Ao começar, o ciclo copia as regras vigentes do cartão: `stamps_required`, `reward_description`, `validity_days` e `reward_validity_days`. [Decidido: mudanças valem só para novos ciclos.]
- **RN-VAL-01** [Decidido] A validade dos pontos conta a partir da **última visita** do ciclo, não da primeira. Se passar `validity_days` sem nova visita, o ciclo vence.
- **RN-VAL-02** [Decidido] Ao vencer, o cliente perde todos os pontos daquele ciclo. Nada é apagado: as visitas continuam no histórico e o ciclo fica `expired`.
- **RN-VAL-03** O vencimento é calculado na hora, quando o dado é lido ou quando uma nova visita chega, sem tarefa agendada obrigatória. Uma visita registrada depois do vencimento abre um novo ciclo do zero.
- **RN-VAL-04** [Premissa] A data de vencimento é a data da última visita (no fuso America/Sao_Paulo) mais `validity_days`. O vencimento vale até o fim desse dia. Essa data é mostrada ao cliente em cada cartão, no campo "Validade". Quando há prêmio disponível, o campo mostra a validade do prêmio (RN-PRE-02).
- **RN-VAL-05** Estornar a última visita de um ciclo recalcula a data da "última visita" para a visita anterior não estornada.
- **RN-VAL-06** [Premissa] Um aviso de vencimento próximo (notificação ou SMS) fica para a fase 2.

---

## 9. Prêmio

- **RN-PRE-01** Quando o ciclo se completa, o sistema cria um prêmio `available` com validade de `reward_validity_days` a partir da conclusão. [Decidido: o prêmio tem validade própria.]
- **RN-PRE-02** O prêmio vence no fim do dia (America/Sao_Paulo) calculado como a data de conclusão mais `reward_validity_days`. Prêmio vencido não pode ser resgatado nem reemitido. [Premissa]
- **RN-PRE-03** O resgate é feito pelo funcionário depois de ler o QR do cliente. O funcionário vê o prêmio disponível, confirma o resgate e o sistema registra quem, quando e qual prêmio.
- **RN-PRE-04** Se há mais de um prêmio disponível na mesma matrícula, o sistema oferece primeiro o que vence antes.
- **RN-PRE-05** Um prêmio resgatado não pode ser desfeito. [Premissa]
- **RN-PRE-06** Depois de completar um ciclo, o cliente já pode acumular um novo ciclo, sem esperar o resgate do prêmio anterior.
- **RN-PRE-07** [Decidido] Quando uma visita é registrada, o cliente vê na hora uma folha sobre o Início: "Carimbo registrado!" com o cartão atualizado, ou "Cartão completo!" com o prêmio e o prazo para resgatar (quando a visita completa o cartão). [Premissa] O app descobre a mudança consultando `GET /v1/customer/enrollments` a cada 5 segundos enquanto está em primeiro plano; SSE fica para a fase 2.
- **RN-PRE-08** [Decidido] Na tela do cartão selecionado (06.1) há o link "Ver detalhes", que abre o detalhe do cartão (06.3). O detalhe mostra o cartão e o histórico de visitas do ciclo atual, da mais recente para a mais antiga, com número da visita ("Visita 7 de 10"), data, hora e o **primeiro nome** de quem carimbou. Visitas estornadas aparecem riscadas com a etiqueta "Estornada" (RN-EST-02) e não contam no progresso. O cliente não vê o motivo do estorno. Dados: `GET /v1/customer/enrollments/:id`.

---

## 10. Estorno

- **RN-EST-01** [Decidido] Só o dono estorna uma visita, com motivo obrigatório (texto livre, mínimo 3 caracteres).
- **RN-EST-02** O estorno não apaga nem altera a visita original. Ele cria um registro novo do tipo `reversal` ligado à visita original. A visita original continua no histórico, marcada como estornada.
- **RN-EST-03** Uma visita só pode ser estornada uma vez.
- **RN-EST-04** Se a visita estornada pertence a um ciclo completo cujo prêmio ainda está `available`, o prêmio é cancelado (`canceled`) e o ciclo volta a `open`, desde que o cliente não tenha começado um ciclo novo depois. Se o prêmio já foi resgatado, ou se já existe um ciclo posterior com visitas, o estorno é recusado (`REVERSAL_NOT_ALLOWED`). [Premissa]
- **RN-EST-05** Visitas de ciclos vencidos podem ser estornadas, mas o estorno não reabre o ciclo. [Premissa]
- **RN-EST-06** Todo estorno entra no log de auditoria, com autor e motivo.

---

## 11. Autenticação

### Cliente (celular + SMS)

- **RN-AUT-01** [Decidido] Login por código de 6 dígitos enviado por SMS. Só números +55 no MVP.
- **RN-AUT-02** O código vale 5 minutos e só serve uma vez. Cada código aceita no máximo 5 tentativas erradas; na quinta, o código é invalidado e o número fica bloqueado por 15 minutos. [Decidido: limites; a ligação entre tentativas e bloqueio é premissa.]
- **RN-AUT-03** Cada número pode pedir no máximo 3 envios por hora. Há também limite por IP (por exemplo 20 pedidos por hora) para evitar abuso do SMS pago. [Premissa para o valor do IP.]
- **RN-AUT-04** O envio de SMS passa por uma interface `OtpSender`, para trocar de provedor (SMS hoje, WhatsApp no futuro) sem mexer na regra. O custo de referência é US$ 0,06 por SMS no Brasil (Twilio), contra R$ 0,09 a R$ 0,19 por mensagem de autenticação no WhatsApp.
- **RN-AUT-05** O código nunca é guardado em texto, só o hash. As respostas não revelam se um número já tem conta.
- **RN-AUT-06** [Decidido] A sessão do cliente é longa (o cliente "já estará logado" ao chegar ao salão). [Premissa] 90 dias com renovação a cada uso.

### Funcionário e dono (e-mail + senha)

- **RN-AUT-07** [Decidido] Login por e-mail e senha. Sessão longa para não atrapalhar o balcão. [Premissa] 30 dias com renovação.
- **RN-AUT-08** [Premissa] Senha de pelo menos 8 caracteres, guardada com Argon2id. Há recuperação de senha por e-mail e limite de tentativas por conta e por IP.
- **RN-AUT-09** O e-mail é único em todo o sistema. [Premissa] Uma pessoa pertence a um negócio só.
- **RN-AUT-10** Cada sessão pode ser revogada. O dono pode desativar um funcionário a qualquer momento (RN-PER-05).

---

## 12. Planos e cobrança

- **RN-PLA-01** [Decidido] Teste grátis de 30 dias, sem cartão de crédito. Depois o negócio precisa assinar.
- **RN-PLA-02** [Decidido] A cobrança é por assinatura mensal no Mercado Pago (API de assinaturas). As taxas giram em torno de 3,99% a 4,99%, conforme o prazo de repasse.
- **RN-PLA-03** [Decidido] O preço varia por faixa de volume de visitas registradas por mês. [Premissa: faixas e valores abaixo são hipótese para validar com os primeiros salões.]

| Plano | Visitas registradas por mês | Preço mensal |
|---|---|---|
| Essencial | até 300 | R$ 39 |
| Profissional | até 800 | R$ 79 |
| Studio | até 2.000 | R$ 149 |
| Grande | até 5.000 | R$ 249 |

Base da hipótese: salões que registram cerca de 50, 100, 200, 500 e 1.000 visitas por semana (aproximadamente 215, 430, 860, 2.150 e 4.300 por mês).

- **RN-PLA-04** [Premissa] O limite de visitas é brando. Passar da faixa nunca bloqueia o balcão. O sistema mostra um aviso ao dono e sugere trocar de plano.
- **RN-PLA-05** Estados da assinatura: `trialing`, `active`, `past_due`, `read_only`. O acesso é total em `trialing`, `active` e `past_due`. Em `read_only` o negócio só lê.
- **RN-PLA-06** [Decidido] Quando o teste acaba sem assinatura, ou o pagamento falha de vez, o negócio vira `read_only`. Em `read_only`: não registra visita, não resgata, não cria nem edita cartões e não convida funcionários. Continua podendo ver painel, clientes e histórico, e assinar de novo. Os clientes continuam vendo seus cartões. **Nenhum dado é apagado.**
- **RN-PLA-07** [Premissa] Pagamento recusado leva a `past_due` por 7 dias (período de carência, com aviso ao dono) e depois a `read_only`.
- **RN-PLA-08** Cancelar mantém o acesso até o fim do período pago e depois vira `read_only`.
- **RN-PLA-09** O estado da assinatura vem dos webhooks do Mercado Pago, tratados de forma idempotente. A tela do dono nunca confia só no retorno do navegador.

---

## 13. Dashboard do dono

- **RN-DAS-01** [Decidido] O painel mostra alguns dados úteis, sempre do negócio e do período escolhido (hoje, 7 dias, 30 dias):
  - visitas registradas;
  - clientes ativos (com visita dentro do prazo de validade);
  - clientes novos;
  - prêmios liberados e resgatados;
  - clientes que voltaram (2 ou mais visitas no período);
  - visitas por funcionário;
  - uso do plano no mês (visitas registradas contra a faixa).
- **RN-DAS-02** [Decidido] Relatórios avançados ficam para a fase 2.

---

## 14. Privacidade e LGPD

- **RN-LGP-01** [Decidido] O negócio é o **controlador** dos dados dos clientes dele; o produto é o **operador**. O contrato (Termos de uso) deve trazer a cláusula de operador. Os textos legais precisam de revisão de um advogado antes da primeira cobrança.
- **RN-LGP-02** O cliente aceita Termos de uso e Política de Privacidade no primeiro login (ao continuar na tela do celular, RN-ENT-08), com data e versão registradas.
- **RN-LGP-03** O consentimento de marketing é separado, opcional e começa desmarcado. Fica registrado por negócio, com data e origem. Sem consentimento, o negócio não vê o celular do cliente para fins de contato. [Premissa] Marketing é a fase 2 (reativação por WhatsApp); o MVP só coleta o consentimento.
- **RN-LGP-04** O cliente pode pedir a exclusão da conta. A rotina anonimiza os dados pessoais (nome, celular, e-mail), mantém as contagens agregadas dos negócios e revoga sessões. O negócio é avisado de que o cliente foi removido.
- **RN-LGP-05** [Premissa] O funcionário vê o celular do cliente parcialmente oculto na leitura. O dono vê o número completo apenas na ficha do cliente, que registra o acesso no log de auditoria.
- **RN-LGP-06** Deve existir um e-mail de contato do encarregado (DPO) na política.
- **RN-LGP-07** O log de auditoria guarda quem fez o quê: estorno, resgate, convite e desativação de funcionário, alteração de cartão e acesso à ficha do cliente.

---

## 15. Fora do escopo do MVP (fase 2 e depois)

Feed de lojas e descoberta; Apple Wallet e Google Wallet; WhatsApp para reativação e lembretes de vencimento; relatórios avançados; fila offline do funcionário; multi-unidade e múltiplos administradores; troca do slug; token do QR gerado no aparelho (HMAC/TOTP); exportação de dados do cliente (portabilidade) como tela; app nativo.

---

## 16. Pontos em aberto

1. Domínio. O nome **Freguês** está definido. O endereço (por exemplo `fregues.com.br`) entra na etiqueta NFC, então deve ser registrado e conferido (Registro.br e INPI) antes de gravar as etiquetas.
2. Preços e faixas finais (RN-PLA-03).
3. Provedor de SMS (Twilio, Zenvia, Infobip ou outro) e custo real em volume.
4. Se a carência de 7 dias (RN-PLA-07) é a desejada.
5. Textos legais (Termos, Privacidade, cláusula de operador): revisão jurídica.
6. Telas ainda não desenhadas: versão web do painel do dono, cadastro do dono no site, convite e recuperação de senha. Decidido: não haverá telas de erro de rede (PWA, só mensagem simples); QR vencido e somente leitura viram avisos nas telas existentes.
7. Consentimento de marketing (RN-LGP-03): as telas aprovadas do cliente não têm onde marcar. Decidir se vai ao Perfil ou à entrada em um negócio (`join`).
8. Cartões com mais de 10 carimbos: o cartão do cliente desenha até 10 círculos em 2 linhas de 5. O banco aceita `stamps_required` de 2 a 30. Decidir se o MVP limita a 10 (ou 12) ou se a grade cresce em linhas.
9. Cor do cartão: o visual de carteira usa uma cor por cartão, escolhida pelo dono (`programs.card_color`). A escolha está desenhada na tela 20 (configurar cartão), com 8 cores: Grafite `#16181B`, Azul-marinho `#1F3A5F`, Marrom `#5B3A29` (texto claro) e Rosa `#F4C6D7`, Verde-claro `#CFE3D4`, Azul-claro `#CFE0F2`, Lilás `#E3D5F0`, Areia `#E9E4D6` (texto escuro). A API deve aceitar só cores dessa paleta.
