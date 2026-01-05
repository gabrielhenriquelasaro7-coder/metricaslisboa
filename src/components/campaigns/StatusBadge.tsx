import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { 
  label: string; 
  variant: 'active' | 'paused' | 'deleted' | 'default';
  className: string;
}> = {
  ACTIVE: {
    label: 'Ativo',
    variant: 'active',
    className: 'status-badge-active',
  },
  PAUSED: {
    label: 'Pausado',
    variant: 'paused',
    className: 'status-badge-paused',
  },
  DELETED: {
    label: 'Excluído',
    variant: 'deleted',
    className: 'status-badge-deleted',
  },
  ARCHIVED: {
    label: 'Arquivado',
    variant: 'deleted',
    className: 'status-badge-deleted',
  },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    variant: 'default' as const,
    className: 'status-badge-default',
  };

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'transition-all duration-300',
        config.className,
        className
      )}
    >
      {/* Pulse indicator for active status */}
      {config.variant === 'active' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      
      {/* Breathing indicator for paused */}
      {config.variant === 'paused' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current opacity-75" />
        </span>
      )}
      
      {/* Static indicator for deleted/archived */}
      {(config.variant === 'deleted' || config.variant === 'default') && (
        <span className="inline-flex rounded-full h-2 w-2 bg-current opacity-50" />
      )}
      
      {config.label}
    </motion.span>
  );
}
