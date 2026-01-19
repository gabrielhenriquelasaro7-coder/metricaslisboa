import { useState, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, X } from 'lucide-react';
import { useChartResponsive } from '@/hooks/useChartResponsive';
import { ResponsiveContainer } from 'recharts';

interface ChartFullscreenProps {
  title: string;
  children: ReactNode;
  renderFullscreenChart?: () => ReactNode;
  controls?: ReactNode;
}

export function ChartFullscreenButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0"
      onClick={onClick}
      title="Expandir gráfico"
    >
      <Maximize2 className="w-3.5 h-3.5" />
    </Button>
  );
}

export function ChartFullscreenModal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  controls 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: ReactNode;
  controls?: ReactNode;
}) {
  const responsiveConfig = useChartResponsive();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed z-50 bg-background flex flex-col"
      style={responsiveConfig.isMobile ? {
        top: '12px',
        left: 'calc(100% - 12px)',
        width: 'calc(100dvh - 24px)',
        height: 'calc(100vw - 24px)',
        transform: 'rotate(90deg)',
        transformOrigin: 'top left',
        borderRadius: '8px',
      } : {
        inset: 0,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-1.5">
          {controls}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 ml-1"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* Chart - fills remaining space */}
      <div className="flex-1 p-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <>{children}</>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function useChartFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  return {
    isFullscreen,
    openFullscreen: () => setIsFullscreen(true),
    closeFullscreen: () => setIsFullscreen(false),
    setIsFullscreen,
  };
}
