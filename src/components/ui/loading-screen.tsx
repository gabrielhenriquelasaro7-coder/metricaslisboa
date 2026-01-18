import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
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
    <motion.div 
      className={cn(
        'flex flex-col items-center justify-center bg-background',
        fullScreen && 'min-h-screen fixed inset-0 z-50',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Background Pattern - matches rest of app */}
      <div className="absolute inset-0 red-texture-bg opacity-20 pointer-events-none" />
      
      {/* Decorative blurs */}
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div 
        className="relative z-10 flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {showLogo && (
          <img
            src={v4LogoFull}
            alt="V4 Company"
            className="h-10"
          />
        )}
        
        {/* Smooth animated dots loader */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-primary"
              animate={{
                y: [0, -6, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        
        <p className="text-sm text-muted-foreground">{message}</p>
      </motion.div>
    </motion.div>
  );
}

export function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={cn('rounded-full bg-primary', sizeClasses[size])}
          animate={{
            y: [0, -4, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export function LoadingCard({ message = 'Carregando...' }: { message?: string }) {
  return (
    <motion.div 
      className="glass-card p-6 flex flex-col items-center justify-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <LoadingSpinner />
      <p className="text-sm text-muted-foreground">{message}</p>
    </motion.div>
  );
}
