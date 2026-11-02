import { OTP_TTL_SECONDS } from './otp-policy';
import type { OtpSender } from './otp-sender';

/**
 * Stands in for the SMS while there is no provider: prints the code in the terminal of the API,
 * so Tiago can sign in during development (decision D-022, a deliberate and temporary exception
 * to golden rule 8). It refuses to exist outside development, so a code can never be printed in
 * a deployed environment. It writes straight to the output, not through the logger, which
 * hides codes on purpose.
 */
export class ConsoleOtpSender implements OtpSender {
  readonly name = 'console';

  constructor(
    nodeEnv: string,
    private readonly write: (line: string) => void = (line) => console.info(line),
  ) {
    if (nodeEnv !== 'development') {
      throw new Error('The console OTP sender only runs in development.');
    }
  }

  async send({ phone, code, expiresAt }: { phone: string; code: string; expiresAt: Date }) {
    const until = expiresAt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    this.write(
      `[OTP simulado] ${phone} -> ${code} (vale ${OTP_TTL_SECONDS / 60} min, até ${until})`,
    );
    return {};
  }
}
