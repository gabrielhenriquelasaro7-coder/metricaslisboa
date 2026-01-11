import { useState } from 'react';
import { Check, ChevronDown, GitBranch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface Pipeline {
  id: string;
  name: string;
  is_main: boolean;
  deals_count: number;
}

interface PipelineSelectorProps {
  pipelines: Pipeline[];
  selectedPipelineId: string | null;
  onSelect: (pipelineId: string) => Promise<void>;
  isLoading?: boolean;
}

export function PipelineSelector({
  pipelines,
  selectedPipelineId,
  onSelect,
  isLoading,
}: PipelineSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId) || 
                          pipelines.find(p => p.is_main) ||
                          pipelines[0];

  const handleSelect = async (pipelineId: string) => {
    if (pipelineId === selectedPipelineId) return;
    
    setIsSelecting(true);
    try {
      await onSelect(pipelineId);
    } finally {
      setIsSelecting(false);
    }
  };

  if (pipelines.length === 0) {
    return null;
  }

  if (pipelines.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border text-sm">
        <GitBranch className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Funil:</span>
        <span className="font-medium">{pipelines[0].name}</span>
        <Badge variant="secondary" className="ml-1 text-xs">
          {pipelines[0].deals_count} deals
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 h-10" 
          disabled={isLoading || isSelecting}
        >
          {isSelecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GitBranch className="w-4 h-4" />
          )}
          <span className="max-w-[200px] truncate">
            {selectedPipeline?.name || 'Selecionar Funil'}
          </span>
          <Badge variant="secondary" className="ml-1 text-xs">
            {selectedPipeline?.deals_count || 0}
          </Badge>
          <ChevronDown className="w-4 h-4 ml-1 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {pipelines.map((pipeline) => (
          <DropdownMenuItem
            key={pipeline.id}
            onClick={() => handleSelect(pipeline.id)}
            className={cn(
              'flex items-center justify-between gap-2 cursor-pointer',
              pipeline.id === selectedPipelineId && 'bg-primary/10'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{pipeline.name}</span>
              {pipeline.is_main && (
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  Principal
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="text-xs">
                {pipeline.deals_count} deals
              </Badge>
              {pipeline.id === selectedPipelineId && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
