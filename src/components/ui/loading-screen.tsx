import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import v4LogoFull from '@/assets/v4-logo-full.png';

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingScreen({ 
  message = 'Carregando...', 
  showLogo = true,
  fullScreen = true,
  className 
}: LoadingScreenProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center',
      fullScreen && 'min-h-screen bg-background',
      className
    )}>
      {fullScreen && (
        <div className="absolute inset-0 red-texture-bg opacity-20 pointer-events-none" />
      )}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {showLogo && (
          <img 
            src={v4LogoFull} 
            alt="V4 Company" 
            className="h-12 animate-pulse" 
          />
        )}
        <div className="relative">
          {/* Outer ring */}
          <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
          {/* Spinning inner ring */}
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          {/* Center icon */}
          <Loader2 className="absolute inset-0 m-auto w-6 h-6 text-primary animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <p className="text-lg text-muted-foreground animate-pulse">{message}</p>
      </div>
    </div>
  );
}

export function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10'
  };
  
  return (
    <Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} />
  );
}

export function LoadingCard({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="glass-card p-8 flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-primary animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
