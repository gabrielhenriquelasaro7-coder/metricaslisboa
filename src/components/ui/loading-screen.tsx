import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingScreen({
  message = 'Carregando...',
  fullScreen = true,
  className
}: LoadingScreenProps) {
  return (
    <motion.div 
      className={cn(
        'flex flex-col items-center justify-center bg-background',
        fullScreen && 'min-h-screen fixed inset-0 z-50',
        !fullScreen && 'min-h-[60vh]',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div 
        className="relative z-10 flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {/* Infinity Symbol Loader */}
        <div className="relative w-16 h-10">
          <svg viewBox="0 0 80 40" className="w-full h-full">
            {/* Background track */}
            <path
              d="M20 20 C20 10, 35 10, 40 20 C45 30, 60 30, 60 20 C60 10, 45 10, 40 20 C35 30, 20 30, 20 20"
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.25"
            />
            {/* Animated segment */}
            <motion.path
              d="M20 20 C20 10, 35 10, 40 20 C45 30, 60 30, 60 20 C60 10, 45 10, 40 20 C35 30, 20 30, 20 20"
              fill="none"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="40 160"
              animate={{
                strokeDashoffset: [0, -200],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </svg>
        </div>
        
        <p className="text-sm text-muted-foreground tracking-widest">{message}</p>
      </motion.div>
    </motion.div>
  );
}

export function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'w-10 h-6', md: 'w-14 h-8', lg: 'w-16 h-10' };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className={cn('relative', sizeMap[size])}>
        <svg viewBox="0 0 80 40" className="w-full h-full">
          <path
            d="M20 20 C20 10, 35 10, 40 20 C45 30, 60 30, 60 20 C60 10, 45 10, 40 20 C35 30, 20 30, 20 20"
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.25"
          />
          <motion.path
            d="M20 20 C20 10, 35 10, 40 20 C45 30, 60 30, 60 20 C60 10, 45 10, 40 20 C35 30, 20 30, 20 20"
            fill="none"
            stroke="hsl(221, 83%, 53%)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="40 160"
            animate={{
              strokeDashoffset: [0, -200],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </svg>
      </div>
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
