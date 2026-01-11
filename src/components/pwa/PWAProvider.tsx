import { ReactNode } from 'react';
import { OfflineIndicator } from './OfflineIndicator';
import { InstallPrompt } from './InstallPrompt';

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  return (
    <>
      <OfflineIndicator />
      {children}
      <InstallPrompt />
    </>
  );
}
