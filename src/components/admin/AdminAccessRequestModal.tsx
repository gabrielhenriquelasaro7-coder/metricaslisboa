import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { useAdminAccessRequests } from '@/hooks/useAdminAccessRequests';

interface AdminAccessRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSent?: () => void;
}

export function AdminAccessRequestModal({
  open,
  onOpenChange,
  onRequestSent,
}: AdminAccessRequestModalProps) {
  const { myPendingRequest, createRequest } = useAdminAccessRequests();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await createRequest(reason.trim());
      onOpenChange(false);
      onRequestSent?.();
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user already has a pending request, show that instead
  if (myPendingRequest) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Solicitação Pendente
            </DialogTitle>
            <DialogDescription>
              Você já possui uma solicitação de acesso aguardando aprovação.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Motivo enviado:</strong>
            </p>
            <p className="text-sm">{myPendingRequest.reason}</p>
            <p className="text-xs text-muted-foreground mt-3">
              Enviado em: {new Date(myPendingRequest.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Solicitar Acesso à Administração
          </DialogTitle>
          <DialogDescription>
            Acesso ao painel de administração requer aprovação do Tech.
            Descreva o motivo da sua solicitação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da solicitação *</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Preciso importar dados históricos do projeto X..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              Seja específico sobre o que precisa fazer no Admin.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !reason.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Solicitação'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
