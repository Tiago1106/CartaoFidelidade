import { useMemo, type ComponentProps } from 'react';
import QRCode from 'qrcode';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

export interface QrCodeProps extends Omit<ComponentProps<'svg'>, 'children'> {
  /** Text to encode (the signed QR token). */
  value: string;
}

/** Quiet zone around the code, in modules. */
const QUIET_ZONE = 2;

/** Draws a QR code as an inline SVG, with the `qrcode` library. */
export function QrCode({ value, className, ...props }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    let d = '';
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.get(x, y)) d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { size: modules.size + QUIET_ZONE * 2, path: d };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={messages.qr.image}
      shapeRendering="crispEdges"
      className={cn('block text-foreground', className)}
      {...props}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
