// All end-user text lives here. Keys are in English, values in Brazilian Portuguese.
export const messages = {
  app: {
    name: 'Freguês',
    tagline: 'Quem volta, ganha.',
  },
  common: {
    close: 'Fechar',
    back: 'Voltar',
  },
  signIn: {
    phone: {
      title: 'Qual é o seu celular?',
      subtitle: 'Enviamos um código por SMS para confirmar que é você.',
      label: 'Celular',
      prefix: '+55',
      placeholder: '(11) 90000-0000',
      termsBefore: 'Ao continuar, você aceita os ',
      termsLink: 'Termos de uso',
      termsMiddle: ' e a ',
      privacyLink: 'Política de Privacidade',
      termsAfter: '.',
      submit: 'Enviar código',
    },
    code: {
      title: 'Digite o código',
      sentToBefore: 'Enviamos 6 dígitos por SMS para ',
      sentToAfter: '.',
      change: 'Alterar número',
      resendIn: (time: string) => `Reenviar código em ${time}`,
      resend: 'Reenviar código',
      confirm: 'Confirmar',
    },
    // [Premissa] Error texts are not in the design; written to be short and plain.
    errors: {
      invalidPhone: 'Confira o número. Use o DDD e 9 dígitos.',
      phoneNotSupported: 'Por enquanto, só números de celular do Brasil (+55).',
      rateLimited: 'Muitos pedidos de código. Tente de novo mais tarde.',
      otpInvalid: 'Código incorreto. Tente de novo.',
      otpExpired: 'Código vencido. Peça um novo código.',
      otpLocked: 'Muitas tentativas. Tente de novo em 15 minutos.',
      generic: 'Algo deu errado. Tente de novo.',
    },
  },
  signUp: {
    title: 'Como podemos te chamar?',
    subtitle: 'É assim que você aparece para quem te atende.',
    label: 'Nome',
    placeholder: 'Seu nome',
    submit: 'Continuar',
    // [Premissa] Not in the design; written to be short and plain.
    error: 'Algo deu errado. Tente de novo.',
  },
  profileChoice: {
    title: 'Como você vai usar o Freguês?',
    description: 'Escolha uma opção para continuar.',
    customer: 'Sou cliente',
    staff: 'Sou prestador',
    hint: 'Chegou pela tag NFC ou pelo QR do negócio? Escolha “Sou cliente”.',
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
        body: 'A cada visita você ganha um carimbo. Acompanhe no app quantos faltam em cada negócio.',
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
