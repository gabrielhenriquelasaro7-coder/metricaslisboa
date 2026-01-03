import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  QrCode, 
  Trash2, 
  LogOut, 
  Pencil, 
  Check, 
  X,
  Loader2
} from 'lucide-react';
import { WhatsAppInstance } from '@/hooks/useWhatsAppInstances';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface WhatsAppInstanceCardProps {
  instance: WhatsAppInstance;
  onConnect: (instanceId: string) => void;
  onDisconnect: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onUpdateName: (instanceId: string, name: string) => void;
  isConnecting?: boolean;
}

export function WhatsAppInstanceCard({
  instance,
  onConnect,
  onDisconnect,
  onDelete,
  onUpdateName,
  isConnecting = false,
}: WhatsAppInstanceCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(instance.display_name);

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(instance.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(instance.display_name);
    setIsEditing(false);
  };

  const getStatusBadge = () => {
    switch (instance.instance_status) {
      case 'connected':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Conectado</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Conectando...</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Desconectado</Badge>;
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '';
    // Format as +55 (XX) XXXXX-XXXX
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  return (
    <Card className="bg-card/50 border-border/50 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg ${
              instance.instance_status === 'connected' 
                ? 'bg-green-500/20' 
                : 'bg-muted'
            }`}>
              <Smartphone className={`h-5 w-5 ${
                instance.instance_status === 'connected' 
                  ? 'text-green-400' 
                  : 'text-muted-foreground'
              }`} />
            </div>
            
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveName}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {instance.display_name}
                  </span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              {instance.instance_status === 'connected' && instance.phone_connected && (
                <p className="text-sm text-muted-foreground truncate">
                  {formatPhone(instance.phone_connected)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge()}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          {instance.instance_status === 'connected' ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => onDisconnect(instance.id)}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            </>
          ) : (
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1"
              onClick={() => onConnect(instance.id)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Conectar
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover conexão?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá remover a conexão "{instance.display_name}" e todos os envios configurados com ela serão desativados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(instance.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
