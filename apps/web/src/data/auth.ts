import type { AuthSessionResponse, OtpRequestResponse } from '@fregues/shared';
import { api } from '@/api/client';

// Sign in of the customer (docs/API.md section 4). The rules (5 minutes, single use, 5 attempts,
// 15 minutes of lock, 3 codes per hour) belong to the server; the screens only show its answers.

/** `POST /v1/customer/auth/otp/request` */
export function requestOtp(phone: string): Promise<OtpRequestResponse> {
  return api.post('/customer/auth/otp/request', { body: { phone } });
}

/** `POST /v1/customer/auth/otp/verify`. The refresh token arrives in a cookie. */
export function verifyOtp(phone: string, code: string): Promise<AuthSessionResponse> {
  return api.post('/customer/auth/otp/verify', { body: { phone, code } });
}

/** `POST /v1/customer/auth/logout`. Ends this login only; can be repeated. */
export function logout(): Promise<void> {
  return api.post('/customer/auth/logout');
}
