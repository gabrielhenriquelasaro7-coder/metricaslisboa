import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import v4LogoFull from '@/assets/v4-logo-full.png';

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
        fullScreen && 'min-h-screen fixed inset-0 z-[100]',
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
        {/* V4 Logo Loader - White full logo */}
        <motion.img 
          src={v4LogoFull} 
          alt="V4" 
          className="h-10 w-auto object-contain brightness-0 invert"
          animate={{ 
            opacity: [0.4, 1, 0.4],
            scale: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        <p className="text-sm text-muted-foreground tracking-widest">{message}</p>
      </motion.div>
    </motion.div>
  );
}

export function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'h-6', md: 'h-8', lg: 'h-10' };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <motion.img 
        src={v4LogoFull} 
        alt="V4" 
        className={cn('w-auto object-contain brightness-0 invert', sizeMap[size])}
        animate={{ 
          opacity: [0.4, 1, 0.4],
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
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
