import { createContext } from 'react';

// Undefined outside the portal shell; null until its header slot mounts.
export const PageHeadContext = createContext<HTMLDivElement | null | undefined>(undefined);
