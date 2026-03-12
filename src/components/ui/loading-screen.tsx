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
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
    >
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Main Ring */}
          <motion.div
            className="absolute inset-0 border-[3px] border-transparent border-t-white/80 rounded-full"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Subtle Outer Track */}
          <div className="absolute inset-0 border-[3px] border-white/10 rounded-full" />

          {/* Logo */}
          <motion.img
            src={v4LogoFull}
            alt="V4"
            className="h-10 w-auto object-contain brightness-0 invert opacity-90"
          />
        </div>

        <p className="text-[10px] text-white/50 uppercase tracking-[0.3em] font-medium">{message}</p>
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
