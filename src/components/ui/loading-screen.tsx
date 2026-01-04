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
      'flex flex-col items-center justify-center bg-background',
      fullScreen && 'min-h-screen fixed inset-0 z-50',
      className
    )}>
      {/* Background Pattern - matches rest of app */}
      <div className="absolute inset-0 red-texture-bg opacity-20 pointer-events-none" />
      
      {/* Decorative blurs */}
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center gap-6">
        {showLogo && (
          <img
            src={v4LogoFull}
            alt="V4 Company"
            className="h-10"
          />
        )}
        
        {/* Fast animated dots loader */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]" style={{ animationDelay: '100ms' }} />
          <div className="w-3 h-3 rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
        </div>
        
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className={cn('rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]', sizeClasses[size])} style={{ animationDelay: '0ms' }} />
      <div className={cn('rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]', sizeClasses[size])} style={{ animationDelay: '100ms' }} />
      <div className={cn('rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]', sizeClasses[size])} style={{ animationDelay: '200ms' }} />
    </div>
  );
}

export function LoadingCard({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]" style={{ animationDelay: '100ms' }} />
        <div className="w-2.5 h-2.5 rounded-full bg-primary animate-[bounce_0.5s_ease-in-out_infinite]" style={{ animationDelay: '200ms' }} />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
