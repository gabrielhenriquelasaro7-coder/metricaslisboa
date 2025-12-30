import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface WhatsAppQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: string | null;
  expiresAt: string | null;
  onRefreshQR: () => void;
  onCheckStatus: () => Promise<{ status: string; phoneNumber: string | null } | null>;
  isLoading?: boolean;
}

export function WhatsAppQRModal({
  open,
  onOpenChange,
  qrCode,
  expiresAt,
  onRefreshQR,
  onCheckStatus,
  isLoading = false,
}: WhatsAppQRModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isExpired, setIsExpired] = useState(false);

  // Check connection status periodically
  useEffect(() => {
    if (!open || isConnected) return;

    const checkConnection = async () => {
      const result = await onCheckStatus();
      if (result?.status === 'connected') {
        setIsConnected(true);
        setPhoneNumber(result.phoneNumber);
      }
    };

    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, [open, isConnected, onCheckStatus]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || isConnected) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);
      setIsExpired(diff === 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isConnected]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setIsConnected(false);
      setPhoneNumber(null);
      setTimeLeft(60);
      setIsExpired(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const formatPhone = (phone: string | null) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isConnected ? 'WhatsApp Conectado!' : 'Conectar WhatsApp'}
          </DialogTitle>
          <DialogDescription>
            {isConnected 
              ? 'Seu WhatsApp foi conectado com sucesso.'
              : 'Escaneie o QR Code com seu WhatsApp para conectar.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Gerando QR Code...</p>
            </div>
          ) : isConnected ? (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-green-500/20">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              {phoneNumber && (
                <p className="text-lg font-medium">{formatPhone(phoneNumber)}</p>
              )}
              <Button onClick={handleClose} className="mt-4">
                Fechar
              </Button>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <div className={`p-4 bg-white rounded-xl ${isExpired ? 'opacity-50' : ''}`}>
                <img 
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              </div>
              
              {isExpired ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-destructive text-sm">QR Code expirado</p>
                  <Button variant="outline" onClick={onRefreshQR}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Gerar novo QR Code
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Expira em {timeLeft}s
                </p>
              )}

              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Abra o WhatsApp no seu celular, vá em Configurações → Aparelhos conectados → Conectar um aparelho
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground">Nenhum QR Code disponível</p>
              <Button variant="outline" onClick={onRefreshQR}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar QR Code
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
