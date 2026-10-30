import type {
  CustomerMe,
  Enrollment,
  EnrollmentDetail,
  QrToken,
  StampEntry,
} from '@fregues/shared';

// Sample data from the design files (Maria and her three cards). Phase B only: in Phase C
// the hooks call the API instead of reading these.

export const customerMe: CustomerMe = {
  id: 'cus_maria',
  name: 'Maria',
  phone: '+5511900000000',
  email: null,
};

export const enrollments: Enrollment[] = [
  {
    id: 'enr_bela',
    business: {
      id: 'biz_bela',
      name: 'Studio Bela',
      slug: 'studio-bela',
      category: 'Salão de beleza',
    },
    program: {
      id: 'prg_bela',
      name: 'Escova',
      rewardDescription: '1 escova grátis',
      cardColor: '#F4C6D7',
    },
    progress: { current: 10, required: 10, cycleNumber: 1, expiresAt: '2026-12-01T02:59:59Z' },
    lastStampAt: '2026-10-30T17:32:00Z',
    availableRedemptions: [
      { id: 'red_bela', rewardDescription: '1 escova grátis', expiresAt: '2026-12-01T02:59:59Z' },
    ],
  },
  {
    id: 'enr_navalha',
    business: {
      id: 'biz_navalha',
      name: 'Barbearia Navalha',
      slug: 'navalha',
      category: 'Barbearia',
    },
    program: {
      id: 'prg_navalha',
      name: 'Corte',
      rewardDescription: '1 corte grátis',
      cardColor: '#16181B',
    },
    progress: { current: 7, required: 10, cycleNumber: 2, expiresAt: '2027-01-01T02:59:59Z' },
    lastStampAt: '2026-10-20T14:10:00Z',
    availableRedemptions: [],
  },
  {
    id: 'enr_vita',
    business: { id: 'biz_vita', name: 'Espaço Vita', slug: 'espaco-vita', category: 'Estética' },
    program: {
      id: 'prg_vita',
      name: 'Limpeza de pele',
      rewardDescription: '1 limpeza de pele grátis',
      cardColor: '#CFE3D4',
    },
    progress: { current: 2, required: 10, cycleNumber: 1, expiresAt: '2027-03-16T02:59:59Z' },
    lastStampAt: '2026-09-28T19:05:00Z',
    availableRedemptions: [],
  },
];

// Stamps of the "Studio Bela" cycle, as in `Cartao-Detalhe.dc.html` (visits 5 to 10).
// Visits 1 to 4 are not in the design; their values are made up.
const belaStamps: StampEntry[] = [
  { number: 10, createdAt: '2026-10-30T17:32:00Z', staffFirstName: 'Ana', reversed: false },
  { number: 9, createdAt: '2026-10-14T20:48:00Z', staffFirstName: 'Ana', reversed: false },
  { number: 8, createdAt: '2026-09-30T13:05:00Z', staffFirstName: 'Rafael', reversed: false },
  { number: 7, createdAt: '2026-09-16T12:20:00Z', staffFirstName: 'Marina', reversed: false },
  { number: 6, createdAt: '2026-09-02T19:10:00Z', staffFirstName: 'Ana', reversed: false },
  { number: 5, createdAt: '2026-08-19T14:42:00Z', staffFirstName: 'Marina', reversed: false },
  { number: 4, createdAt: '2026-08-05T18:00:00Z', staffFirstName: 'Ana', reversed: false },
  { number: 3, createdAt: '2026-07-22T13:30:00Z', staffFirstName: 'Rafael', reversed: false },
  { number: 2, createdAt: '2026-07-08T21:15:00Z', staffFirstName: 'Marina', reversed: false },
  { number: 1, createdAt: '2026-06-24T12:40:00Z', staffFirstName: 'Ana', reversed: false },
];

/** Stamps for the other cards: one every two weeks back from the last one. */
function generatedStamps(enrollment: Enrollment): StampEntry[] {
  const last = enrollment.lastStampAt ? Date.parse(enrollment.lastStampAt) : 0;
  const staff = ['Ana', 'Rafael', 'Marina'];
  return Array.from({ length: enrollment.progress.current }, (_, i) => ({
    number: enrollment.progress.current - i,
    createdAt: new Date(last - i * 14 * 24 * 60 * 60 * 1000).toISOString(),
    staffFirstName: staff[i % staff.length]!,
    reversed: false,
  }));
}

export function enrollmentDetail(id: string): EnrollmentDetail | undefined {
  const enrollment = enrollments.find((item) => item.id === id);
  if (!enrollment) return undefined;
  return {
    ...enrollment,
    stamps: id === 'enr_bela' ? belaStamps : generatedStamps(enrollment),
  };
}

export function qrToken(sequence: number): QrToken {
  const token = `fixture-token-${sequence}`;
  return {
    token,
    qrPayload: `lc1.${token}`,
    expiresAt: '2026-10-30T18:00:45Z',
    renewInSeconds: 30,
  };
}
