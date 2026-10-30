import { Outlet } from 'react-router-dom';

/**
 * Phone frame. On a phone the app fills the screen. On a wider screen it sits in the
 * middle as a 390 x 844 phone, the size of the design canvas.
 */
export function AppFrame() {
  return (
    <div className="min-h-dvh sm:flex sm:items-center sm:justify-center sm:p-6">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background sm:h-[844px] sm:max-h-[calc(100dvh-3rem)] sm:w-[390px] sm:rounded-[40px] sm:border-[1.5px]">
        <Outlet />
      </div>
    </div>
  );
}
