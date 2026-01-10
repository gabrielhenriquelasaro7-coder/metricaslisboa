import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Smartphone, Wifi, WifiOff, Trash2, Edit3, Check, X, Loader2 } from 'lucide-react';
import type { ManagerInstance } from '@/hooks/useWhatsAppManager';

interface ManagerInstanceCardProps {
  instance: ManagerInstance;
  onConnect: (instanceId: string) => void;
  onDisconnect: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onUpdateName: (instanceId: string, name: string) => void;
  isConnecting?: boolean;
}

export function ManagerInstanceCard({
  instance,
  onConnect,
  onDisconnect,
  onDelete,
  onUpdateName,
  isConnecting
}: ManagerInstanceCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(instance.display_name);

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(instance.id, editName.trim());
    }
    setIsEditing(false);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 12) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  const isConnected = instance.instance_status === 'connected';

  return (
    <Card className="border-0 bg-muted/30 backdrop-blur-sm group">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${isConnected ? 'bg-metric-positive/20' : 'bg-muted'}`}>
              <Smartphone className={`w-4 h-4 sm:w-5 sm:h-5 ${isConnected ? 'text-metric-positive' : 'text-muted-foreground'}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 sm:h-8 text-xs sm:text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditing(false);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" onClick={handleSaveName}>
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" onClick={() => setIsEditing(false)}>
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h4 className="font-medium truncate text-sm sm:text-base">{instance.display_name}</h4>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 sm:h-6 sm:w-6 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={() => {
                      setEditName(instance.display_name);
                      setIsEditing(true);
                    }}
                  >
                    <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </Button>
                </div>
              )}
              
              {instance.phone_connected && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {formatPhone(instance.phone_connected)}
                </p>
              )}
            </div>
          </div>

          <Badge 
            variant={isConnected ? 'default' : 'secondary'}
            className={`text-[10px] sm:text-xs self-start sm:self-auto flex-shrink-0 ${isConnected ? 'bg-metric-positive/20 text-metric-positive border-metric-positive/30' : ''}`}
          >
            {isConnected ? (
              <><Wifi className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" /> Conectado</>
            ) : (
              <><WifiOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" /> Desconectado</>
            )}
          </Badge>
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-border/30">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDisconnect(instance.id)}
              className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
            >
              Desconectar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onConnect(instance.id)}
              disabled={isConnecting}
              className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
            >
              {isConnecting ? (
                <><Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" /> Conectando...</>
              ) : (
                'Conectar'
              )}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base sm:text-lg">Remover conexão?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm">
                  Isso irá desconectar o WhatsApp e remover todas as configurações de envio vinculadas a esta conexão.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel className="h-8 sm:h-9 text-xs sm:text-sm">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(instance.id)} className="h-8 sm:h-9 text-xs sm:text-sm bg-destructive text-destructive-foreground">
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
