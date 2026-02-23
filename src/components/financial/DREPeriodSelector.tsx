import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, ChevronDown, History, Check } from 'lucide-react';
import type { DREPeriod } from './CompleteDRE';

interface DREPeriodSelectorProps {
  value: DREPeriod;
  onChange: (period: DREPeriod) => void;
  onOpenHistory?: () => void;
  periodDescription?: string;
}

const PERIOD_OPTIONS: { key: DREPeriod; label: string }[] = [
  { key: 'this_month', label: 'Mês atual' },
  { key: 'last_month', label: 'Mês passado' },
  { key: 'last_7d', label: 'Últimos 7 dias' },
  { key: 'last_30d', label: 'Últimos 30 dias' },
];

export function DREPeriodSelector({ value, onChange, onOpenHistory, periodDescription }: DREPeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const currentLabel = PERIOD_OPTIONS.find(p => p.key === value)?.label || 'Período';

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="truncate max-w-[160px]">{currentLabel}</span>
            {periodDescription && (
              <span className="text-xs text-muted-foreground hidden sm:inline">({periodDescription})</span>
            )}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <DropdownMenuItem
              key={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className="flex items-center justify-between"
            >
              {label}
              {value === key && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          {onOpenHistory && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenHistory} className="gap-2">
                <History className="h-4 w-4" />
                Histórico de DRE
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
