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
    <Card className="border-sidebar-border bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-metric-positive/20' : 'bg-muted'}`}>
              <Smartphone className={`w-5 h-5 ${isConnected ? 'text-metric-positive' : 'text-muted-foreground'}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditing(false);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{instance.display_name}</h4>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditName(instance.display_name);
                      setIsEditing(true);
                    }}
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              {instance.phone_connected && (
                <p className="text-sm text-muted-foreground">
                  {formatPhone(instance.phone_connected)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge 
              variant={isConnected ? 'default' : 'secondary'}
              className={isConnected ? 'bg-metric-positive/20 text-metric-positive border-metric-positive/30' : ''}
            >
              {isConnected ? (
                <><Wifi className="w-3 h-3 mr-1" /> Conectado</>
              ) : (
                <><WifiOff className="w-3 h-3 mr-1" /> Desconectado</>
              )}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-sidebar-border">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDisconnect(instance.id)}
            >
              Desconectar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onConnect(instance.id)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Conectando...</>
              ) : (
                'Conectar'
              )}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover conexão?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá desconectar o WhatsApp e remover todas as configurações de envio vinculadas a esta conexão.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(instance.id)} className="bg-destructive text-destructive-foreground">
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
