import { useMutation } from '@tanstack/react-query';
import { requestOtp, verifyOtp } from '../auth';

// Phase B: simulated. In Phase C these call `/v1/customer/auth/otp/request` and `.../verify`.

/** Asks for an SMS code for a +55 number. */
export function useRequestOtp() {
  return useMutation({ mutationFn: (phone: string) => requestOtp(phone) });
}

/** Confirms the code and opens the session. */
export function useVerifyOtp() {
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => verifyOtp(phone, code),
  });
}
