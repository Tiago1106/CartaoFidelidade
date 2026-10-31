import { createContext, useContext } from 'react';

/**
 * The element of the phone frame. Sheets render inside it (not in `document.body`), so on a
 * wide screen they stay inside the 390 px phone instead of covering the whole browser.
 */
export const FrameContainerContext = createContext<HTMLElement | null>(null);

export function useFrameContainer(): HTMLElement | null {
  return useContext(FrameContainerContext);
}
