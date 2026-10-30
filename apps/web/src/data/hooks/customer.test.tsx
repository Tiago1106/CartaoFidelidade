import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCustomerMe, useEnrollment, useEnrollments, useQrToken } from './customer';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('customer data hooks (fixtures)', () => {
  it('returns Maria', async () => {
    const { result } = renderHook(() => useCustomerMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Maria');
  });

  it('lists the three cards of the design, the complete one first', async () => {
    const { result } = renderHook(() => useEnrollments(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = result.current.data ?? [];
    expect(items.map((e) => e.business.name)).toEqual([
      'Studio Bela',
      'Barbearia Navalha',
      'Espaço Vita',
    ]);
    expect(items[0]?.progress.current).toBe(items[0]?.progress.required);
    expect(items[0]?.availableRedemptions).toHaveLength(1);
  });

  it('gives each card the stamps of its current cycle, most recent first', async () => {
    const { result } = renderHook(() => useEnrollment('enr_navalha'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const stamps = result.current.data?.stamps ?? [];
    expect(stamps).toHaveLength(7);
    expect(stamps.map((s) => s.number)).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it('fails for a card that does not exist', async () => {
    const { result } = renderHook(() => useEnrollment('nope'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not fetch without an id', () => {
    const { result } = renderHook(() => useEnrollment(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('RN-QR-01: issues a QR token that renews every 30 seconds', async () => {
    const { result } = renderHook(() => useQrToken(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.renewInSeconds).toBe(30);
    expect(result.current.data?.qrPayload.startsWith('lc1.')).toBe(true);
  });

  it('returns a copy, so a screen cannot change the fixture', async () => {
    const first = renderHook(() => useEnrollments(), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.result.current.data![0]!.business.name = 'Changed';
    const second = renderHook(() => useEnrollments(), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(second.result.current.data![0]!.business.name).toBe('Studio Bela');
  });
});
