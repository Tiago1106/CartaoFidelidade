# Logo Freguês

Marca: um **selo de carimbo** com a letra F. Nome: **Freguês**, em Manrope ExtraBold. Slogan: **Quem volta, ganha.** (Manrope Bold). Nos SVGs, todo texto já está convertido em curvas, então não depende de fonte instalada.

## Arquivos

### `svg/`

| Arquivo | Uso |
|---|---|
| `mark.svg` | Só o selo, colorido (preto quente com F âmbar). Fundos claros ou âmbar. |
| `mark-black.svg` · `mark-white.svg` | Selo de uma cor, com o F vazado. Impressão, carimbo, bordado, fundos fotográficos. |
| `mark-on-dark.svg` | Selo âmbar com o F vazado. Fundos escuros. |
| `app-icon.svg` | Ícone do app: quadrado arredondado âmbar com o selo. |
| `favicon.svg` | Versão simplificada para 16 a 48 px (sem o anel pontilhado, selo e F maiores). |
| `horizontal.svg` | Selo e nome lado a lado. Cabeçalhos, e-mails, documentos. Fundos claros. |
| `horizontal-black.svg` · `horizontal-white.svg` | Mesma versão, em uma cor. |
| `horizontal-on-dark.svg` | Selo âmbar e nome em creme, para fundos escuros. |
| `vertical-with-tagline.svg` | Selo, nome e slogan, centralizados. Tela inicial, landing, etiqueta NFC, cartaz do balcão. |
| `vertical-with-tagline-on-dark.svg` | Mesma versão para fundos escuros. |

### `png/` e `favicon.ico`

| Arquivo | Uso |
|---|---|
| `icon-192.png` · `icon-512.png` | Ícones do PWA (`purpose: any`), com cantos arredondados transparentes. |
| `icon-maskable-512.png` | Ícone do PWA `maskable`: quadrado âmbar sem cantos, com o selo dentro da zona segura (80% central). |
| `apple-touch-icon-180.png` | Ícone do iOS. Quadrado sem transparência (o iOS arredonda sozinho). |
| `favicon-16.png` · `favicon-32.png` · `favicon-48.png` · `favicon.ico` | Favicon. |
| `mark-1024.png` | Selo colorido em fundo transparente, para quem precisar de PNG grande. |

## Cores

| Cor | Valor | Onde |
|---|---|---|
| Âmbar | `#F2B84B` | F, anel pontilhado, fundo do ícone do app. |
| Preto quente | `#1A1305` | Selo, nome. |
| Creme | `#F7F6F2` | Nome sobre fundo escuro. |
| Cinza do slogan | `#5B6068` (claro) · `#CFCBBE` (escuro) | Slogan. |

## Regras de uso

- **Área livre:** deixe em volta da logo, em todos os lados, pelo menos 1/4 do diâmetro do selo.
- **Tamanho mínimo:** selo sozinho, 24 px. Versão horizontal, selo com 28 px de altura (cerca de 120 px de largura total). Abaixo de 48 px, use `favicon.svg` ou os `favicon-*.png`.
- **Fundos:** colorido em fundo claro, creme ou âmbar. Em fundo escuro, use sempre a versão "sobre escuro". Em fotos, use a de uma cor (preta ou branca).
- **Não faça:** esticar ou girar, trocar as cores, adicionar sombra ou contorno, trocar a fonte do nome, escrever o nome sem o acento, colocar a versão colorida sobre fundo escuro.

## Uso no PWA

No `<head>`:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<meta name="theme-color" content="#F2B84B">
```

No `manifest.webmanifest`:

```json
{
  "name": "Freguês",
  "short_name": "Freguês",
  "description": "Quem volta, ganha.",
  "lang": "pt-BR",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F7F6F2",
  "theme_color": "#F2B84B",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## Pendências

- Esta logo ainda não passou por pesquisa de similaridade no INPI. Faça antes de investir em material impresso.
- O desenho do selo é de autoria deste projeto. O F e o nome usam a fonte Manrope (licença OFL).
