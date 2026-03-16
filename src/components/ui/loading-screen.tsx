import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import v4LogoIcon from '@/assets/v4-logo-icon.png';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

function CircularLoader({ size = 80 }: { size?: number }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg className="absolute inset-0" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted-foreground/20"
          strokeWidth={strokeWidth}
        />
      </svg>
      {/* Animated arc */}
      <motion.svg
        className="absolute inset-0"
        width={size}
        height={size}
        style={{ rotate: -90 }}
        animate={{ rotate: ["-90deg", "270deg"] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      >
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted-foreground/60"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{
            strokeDashoffset: [circumference * 0.75, circumference * 0.25, circumference * 0.75],
          }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.svg>
      {/* Logo in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={v4LogoIcon}
          alt="V4"
          className="w-[45%] h-[45%] object-contain dark:brightness-0 dark:invert"
        />
      </div>
    </div>
  );
}

export function LoadingScreen({
  message = 'CARREGANDO...',
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
        className="relative z-10 flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <CircularLoader size={90} />
        <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase">{message}</p>
      </motion.div>
    </motion.div>
  );
}

export function LoadingSpinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 48, md: 64, lg: 80 };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <CircularLoader size={sizeMap[size]} />
    </div>
  );
}

export function LoadingCard({ message = 'CARREGANDO...' }: { message?: string }) {
  return (
    <motion.div
      className="glass-card p-6 flex flex-col items-center justify-center gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <LoadingSpinner />
      <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase">{message}</p>
    </motion.div>
  );
}

export { CircularLoader };
