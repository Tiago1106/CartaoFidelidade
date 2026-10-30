import { useQuery } from '@tanstack/react-query';
import type { CustomerMe, Enrollment, EnrollmentDetail, QrToken } from '@fregues/shared';
import { fakeRequest } from '../fakeRequest';
import { customerMe, enrollmentDetail, enrollments, qrToken } from '../fixtures/customer';

// Screens read data only through these hooks (decision D-008). In Phase C each `queryFn`
// calls the API (`/v1/customer/...`) and nothing else changes.

export const customerKeys = {
  me: ['customer', 'me'] as const,
  enrollments: ['customer', 'enrollments'] as const,
  enrollment: (id: string) => ['customer', 'enrollments', id] as const,
  qrToken: ['customer', 'qr-token'] as const,
};

/** `GET /v1/customer/me` */
export function useCustomerMe() {
  return useQuery<CustomerMe>({
    queryKey: customerKeys.me,
    queryFn: () => fakeRequest(customerMe),
  });
}

/** `GET /v1/customer/enrollments` */
export function useEnrollments() {
  return useQuery<Enrollment[]>({
    queryKey: customerKeys.enrollments,
    queryFn: () => fakeRequest(enrollments),
  });
}

/** `GET /v1/customer/enrollments/:id` */
export function useEnrollment(id: string | undefined) {
  return useQuery<EnrollmentDetail>({
    queryKey: customerKeys.enrollment(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const detail = enrollmentDetail(id ?? '');
      if (!detail) throw new Error('enrollment_not_found');
      return fakeRequest(detail);
    },
  });
}

let qrSequence = 0;

/** `POST /v1/customer/qr-token`, asked again every `renewInSeconds`. */
export function useQrToken() {
  return useQuery<QrToken>({
    queryKey: customerKeys.qrToken,
    queryFn: () => fakeRequest(qrToken(++qrSequence)),
    refetchInterval: (query) => (query.state.data?.renewInSeconds ?? 30) * 1000,
    staleTime: 0,
    gcTime: 0,
  });
}
