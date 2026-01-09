import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle } from 'lucide-react';

interface SuggestionActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestionTitle: string;
  actionType: 'applied' | 'ignored';
  onConfirm: (reason?: string) => void;
}

export function SuggestionActionDialog({
  open,
  onOpenChange,
  suggestionTitle,
  actionType,
  onConfirm,
}: SuggestionActionDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await onConfirm(reason.trim() || undefined);
    setIsSubmitting(false);
    setReason('');
    onOpenChange(false);
  };

  const isApplied = actionType === 'applied';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApplied ? (
              <CheckCircle2 className="w-5 h-5 text-metric-positive" />
            ) : (
              <XCircle className="w-5 h-5 text-muted-foreground" />
            )}
            {isApplied ? 'Marcar como Aplicada' : 'Marcar como Ignorada'}
          </DialogTitle>
          <DialogDescription>
            {isApplied 
              ? 'Você aplicou esta sugestão? Adicione um comentário opcional sobre o que foi feito.'
              : 'Por que você está ignorando esta sugestão? (opcional)'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">{suggestionTitle}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              {isApplied ? 'O que foi feito? (opcional)' : 'Motivo (opcional)'}
            </Label>
            <Textarea
              id="reason"
              placeholder={isApplied 
                ? 'Ex: Aumentei o orçamento em 20% conforme sugerido...'
                : 'Ex: Já estava em andamento, não se aplica ao momento...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {reason.length}/500
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isSubmitting}
            variant={isApplied ? 'default' : 'secondary'}
          >
            {isSubmitting ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
