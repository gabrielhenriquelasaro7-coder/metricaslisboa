import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAStatus {
  isInstalled: boolean;
  isInstallable: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<PWAStatus>({
    isInstalled: false,
    isInstallable: false,
    isOnline: navigator.onLine,
    isStandalone: false,
    platform: 'unknown'
  });

  // Detect platform
  const detectPlatform = useCallback((): 'ios' | 'android' | 'desktop' | 'unknown' => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    if (/windows|mac|linux/.test(ua) && !/mobile/.test(ua)) return 'desktop';
    return 'unknown';
  }, []);

  // Check if running as installed PWA
  const checkStandalone = useCallback((): boolean => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }, []);

  // Check if already installed (heuristic)
  const checkInstalled = useCallback((): boolean => {
    // If running standalone, it's installed
    if (checkStandalone()) return true;
    
    // Check localStorage flag
    const installed = localStorage.getItem('pwa-installed');
    return installed === 'true';
  }, [checkStandalone]);

  useEffect(() => {
    const platform = detectPlatform();
    const isStandalone = checkStandalone();
    const isInstalled = checkInstalled();

    setStatus(prev => ({
      ...prev,
      platform,
      isStandalone,
      isInstalled
    }));

    // Listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setStatus(prev => ({ ...prev, isInstallable: true }));
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
      setStatus(prev => ({ 
        ...prev, 
        isInstalled: true, 
        isInstallable: false 
      }));
    };

    // Listen for online/offline
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [detectPlatform, checkStandalone, checkInstalled]);

  // Trigger install prompt
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-installed', 'true');
        setStatus(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Get iOS install instructions
  const getIOSInstallInstructions = useCallback(() => {
    return {
      steps: [
        'Toque no botão de Compartilhar (ícone de seta para cima)',
        'Role para baixo e toque em "Adicionar à Tela de Início"',
        'Toque em "Adicionar" para confirmar'
      ],
      note: 'O app será instalado e abrirá em tela cheia'
    };
  }, []);

  return {
    ...status,
    canPromptInstall: !!deferredPrompt,
    promptInstall,
    getIOSInstallInstructions
  };
}
