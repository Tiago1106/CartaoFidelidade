// All end-user text lives here. Keys are in English, values in Brazilian Portuguese.
export const messages = {
  app: {
    name: 'Freguês',
    tagline: 'Quem volta, ganha.',
  },
  shell: {
    placeholder: 'Tela em construção',
  },
  onboarding: {
    // Sample card drawn in the welcome illustration.
    sampleCard: 'Barbearia Navalha · 7 de 10',
  },
  welcome: {
    skip: 'Pular',
    next: 'Continuar',
    start: 'Começar',
    slides: [
      {
        title: 'Mostre seu QR Code',
        body: 'Em cada visita, abra o app e mostre seu código. Quem atende escaneia em segundos, sem cartão de papel.',
      },
      {
        title: 'Junte carimbos',
        body: 'A cada visita você ganha um carimbo. Acompanhe no app quantos faltam em cada salão.',
      },
      {
        title: 'Troque por prêmios',
        body: 'Completou o cartão? O prêmio fica disponível para você resgatar na próxima visita.',
      },
    ],
  },
  nav: {
    label: 'Navegação principal',
    customer: { cards: 'Cartões', qr: 'Meu QR', profile: 'Perfil' },
    owner: {
      dashboard: 'Painel',
      cards: 'Cartões',
      customers: 'Clientes',
      staff: 'Equipe',
      plan: 'Plano',
    },
  },
  stepDots: {
    label: (step: number, total: number) => `Passo ${step} de ${total}`,
  },
  otp: {
    label: 'Código de verificação de 6 dígitos',
  },
  stampGrid: {
    label: (current: number, total: number) => `${current} de ${total} carimbos`,
  },
  programCard: {
    label: (name: string, current: number, total: number) =>
      `Cartão ${name}, ${current} de ${total} carimbos`,
    expiry: 'Validade',
    reward: 'Prêmio',
    available: 'Disponível',
    remaining: (count: number) => (count === 1 ? 'Falta 1 carimbo' : `Faltam ${count} carimbos`),
  },
  qr: {
    image: 'QR Code',
    progressLabel: 'Tempo até renovar o código',
    renewsIn: (time: string) => `Renova em ${time}`,
    showCode: 'Mostre este código',
    details: 'Ver detalhes',
  },
} as const;
