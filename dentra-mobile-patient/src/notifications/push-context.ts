import { createContext } from 'react';
import type { PushState } from './push-manager';

export const PushContext = createContext<{
  state: PushState;
  enable: () => Promise<void>;
}>({
  state: 'unavailable',
  enable: async () => {},
});
