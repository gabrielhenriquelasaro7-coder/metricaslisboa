import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { WhatsAppGroup } from '@/hooks/useWhatsAppInstances';

interface WhatsAppGroupSelectorProps {
  groups: WhatsAppGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string, groupName: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function WhatsAppGroupSelector({
  groups,
  selectedGroupId,
  onSelectGroup,
  onRefresh,
  isLoading = false,
  disabled = false,
}: WhatsAppGroupSelectorProps) {
  const handleSelectGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      onSelectGroup(group.id, group.name);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedGroupId || ''}
        onValueChange={handleSelectGroup}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Selecione um grupo">
            {selectedGroupId && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{groups.find(g => g.id === selectedGroupId)?.name || 'Grupo'}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {groups.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum grupo encontrado
            </div>
          ) : (
            groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{group.name}</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
