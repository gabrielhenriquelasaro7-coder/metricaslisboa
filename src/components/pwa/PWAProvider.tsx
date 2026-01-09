import { ReactNode } from 'react';
import { OfflineIndicator } from './OfflineIndicator';
import { InstallPrompt } from './InstallPrompt';
import { UpdatePrompt } from './UpdatePrompt';

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  return (
    <>
      <OfflineIndicator />
      <UpdatePrompt />
      {children}
      <InstallPrompt />
    </>
  );
}
