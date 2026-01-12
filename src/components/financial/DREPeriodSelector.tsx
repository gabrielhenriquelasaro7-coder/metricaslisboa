import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, ChevronDown, History } from 'lucide-react';
import type { DREPeriod } from './CompleteDRE';

interface DREPeriodSelectorProps {
  value: DREPeriod;
  onChange: (period: DREPeriod) => void;
  onOpenHistory?: () => void;
}

const PERIOD_LABELS: Record<DREPeriod, string> = {
  last_7d: 'Últimos 7 dias',
  last_30d: 'Últimos 30 dias',
  this_month: 'Mês atual',
  last_month: 'Mês passado',
  custom: 'Personalizado',
};

export function DREPeriodSelector({ value, onChange, onOpenHistory }: DREPeriodSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            {PERIOD_LABELS[value]}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => {
                onChange(key as DREPeriod);
                setOpen(false);
              }}
              className={value === key ? 'bg-accent' : ''}
            >
              {label}
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
