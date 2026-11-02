import { Inject } from '@nestjs/common';

/**
 * How a code reaches the customer (RN-AUT-04). SMS today, WhatsApp later: the rules only know
 * this interface, so changing the provider does not touch them.
 */
export interface OtpSender {
  /** Short name of the provider, saved with each message (`sms_messages.provider`). */
  readonly name: string;
  /** Sends the code. Throws when the provider could not take the message. */
  send(message: { phone: string; code: string; expiresAt: Date }): Promise<{
    providerMessageId?: string;
  }>;
}

export const OTP_SENDER = Symbol('OTP_SENDER');
export const InjectOtpSender = () => Inject(OTP_SENDER);
