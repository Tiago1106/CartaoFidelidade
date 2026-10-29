import '@fontsource-variable/manrope';
import '../src/index.css';
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        app: {
          name: 'App 390 x 844',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
    backgrounds: { disabled: true },
  },
  initialGlobals: {
    viewport: { value: 'app', isRotated: false },
  },
};

export default preview;
