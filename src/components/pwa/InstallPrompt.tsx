import { useState, useEffect } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

export function InstallPrompt() {
  const { 
    isInstalled, 
    isInstallable, 
    isStandalone, 
    platform, 
    canPromptInstall, 
    promptInstall,
    getIOSInstallInstructions 
  } = usePWA();
  
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if we should show the prompt
  useEffect(() => {
    // Don't show if already installed, in standalone mode, or dismissed
    if (isInstalled || isStandalone || dismissed) {
      setShowPrompt(false);
      return;
    }

    // Check if user has dismissed recently
    const lastDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (lastDismissed) {
      const dismissedDate = new Date(lastDismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Show prompt after a delay
    const timer = setTimeout(() => {
      if (canPromptInstall || platform === 'ios') {
        setShowPrompt(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isInstalled, isStandalone, canPromptInstall, platform, dismissed]);

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowIOSInstructions(true);
      return;
    }

    const success = await promptInstall();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
  };

  const iosInstructions = getIOSInstallInstructions();

  if (!showPrompt && !showIOSInstructions) return null;

  return (
    <AnimatePresence>
      {showIOSInstructions ? (
        <motion.div
          key="ios-instructions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4"
          onClick={() => setShowIOSInstructions(false)}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Instalar V4 Traffic</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowIOSInstructions(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {iosInstructions.steps.map((step, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {index === 0 && <Share className="h-4 w-4 text-primary" />}
                        {index === 1 && <Plus className="h-4 w-4 text-primary" />}
                        <span>{step}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  {iosInstructions.note}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : showPrompt ? (
        <motion.div
          key="install-prompt"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Card className="bg-card border-border shadow-xl">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">Instalar V4 Traffic</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Instale o app para acesso rápido e funcionamento offline
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 -mt-1 -mr-1"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleDismiss}
                >
                  Depois
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleInstall}
                >
                  Instalar
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
