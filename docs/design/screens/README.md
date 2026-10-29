# Telas do Freguês (referência de design)

Estes arquivos são a **fonte do desenho** aprovado, tela a tela, no Claude Design (canvas). Cada `.dc.html` é um quadro ou um componente. Eles descrevem a estrutura, os textos, as cores e os espaçamentos exatos. **Não são código para copiar**: reimplemente em React + Tailwind + shadcn/ui, usando o mapa de componentes do `CLAUDE.md`.

## Como ler um arquivo

- O HTML dentro de `<x-dc>` é a tela. Os estilos estão inline, com os valores em hex.
- `<dc-import name="X" ...>` usa o componente `X.dc.html` com as props indicadas. `hint-size` só indica o tamanho no canvas.
- `{{valor}}`, `<sc-if>` e `<sc-for>` são os pontos variáveis. A lógica de cada componente está no `class Component` no fim do arquivo (por exemplo, o estilo do cartão claro e escuro).
- Quadro padrão do celular: 390 x 844. Textos, nomes e números são dados de exemplo.

## Índice

Cliente: `Pagina-Negocio` (00, aberta pelo NFC ou QR do balcão), `Main` (01.1), `Onboarding-2`, `Onboarding-3`, `Escolha-Perfil` (02), `Entrada-Celular` (03), `Entrada-Codigo` (04), `Cadastro` (05), `Inicio` (06), `Inicio-Selecionado` (06.1), `Inicio-Vazio` (06.2), `Cartao-Detalhe` (06.3), `Meu-QR` (07), `Perfil` (08), `Carimbo-Registrado` (09), `Cartao-Completo` (10).

Equipe: `Equipe-Entrar` (11), `Equipe-Leitor` (12), `Equipe-Confirmar` (13), `Equipe-Confirmar-Intervalo` (13.1), `Equipe-Registrada` (14), `Equipe-Muito-Cedo` (15), `Equipe-Resgate` (16), `Equipe-Celular` (17).

Dono: `Dono-Painel` (18), `Dono-Cartoes` (19), `Dono-CartaoForm` (20), `Dono-Clientes` (21), `Dono-Cliente` (22, ficha), `Dono-Equipe` (23), `Dono-Convidar` (24, folha), `Dono-Plano` (25), `Dono-QrBalcao` (26), `Dono-Estornar` (27, folha).

Componentes: `Botao`, `BotaoIcone`, `Pontos`, `Selo`, `Icone`, `Ilustracao`, `Campo`, `Codigo`, `CartaoFidelidade`, `BarraAbas`, `LinhaMenu`, `OpcaoCartao`, `Segmentado`, `Indicador`, `LinhaBarra`, `LinhaCartao`, `LinhaCliente`, `LinhaFuncionario`, `LinhaHistorico`, `SeletorCor`.

## Decisões de design que não estão óbvias no HTML

- A tela 05 (Cadastro) aparece só no primeiro acesso.
- A aba Meu QR existe para o cliente sem cartão (RN-ENT-09). O QR mostra a contagem de 30 s.
- Cartões do Início ficam empilhados; o cartão tocado abre inteiro (06.1) com o QR colado nele.
- O link "Ver detalhes" da 06.1 abre a 06.3 (visitas do cartão, com quem carimbou e a hora). Cliente vê só o primeiro nome do funcionário.
- Folhas fecham pelo X no canto superior direito.
- O funcionário abre direto no leitor (12).
- Dono: barra inferior com cinco abas. Ficha do cliente, configurar cartão e QR do balcão são telas de detalhe (sem barra, com voltar). Convidar e estornar são folhas sobre a tela de origem.
- O QR do balcão (26) é fixo e não renova; só o QR do cliente renova a cada 30 s.
- Estornar (27) exige motivo e avisa quando o estorno cancela um prêmio disponível (RN-EST-04).
