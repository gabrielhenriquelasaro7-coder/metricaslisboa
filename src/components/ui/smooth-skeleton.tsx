import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface SmoothSkeletonProps {
  className?: string;
  variant?: 'default' | 'card' | 'text' | 'circle';
}

// Skeleton with smooth shimmer effect instead of pulse
export function SmoothSkeleton({ className, variant = 'default' }: SmoothSkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted/50 rounded-md',
        variant === 'card' && 'rounded-lg',
        variant === 'circle' && 'rounded-full',
        className
      )}
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
        animate={{ translateX: ['−100%', '100%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
          repeatDelay: 0.5,
        }}
      />
    </div>
  );
}

// Fade transition wrapper for content loading
export function FadeTransition({ 
  children, 
  show,
  className = '' 
}: { 
  children: React.ReactNode; 
  show: boolean;
  className?: string;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ 
        opacity: show ? 1 : 0,
        y: show ? 0 : 8
      }}
      transition={{ 
        duration: 0.3, 
        ease: 'easeOut' 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Smooth content transition - shows skeleton while loading, then fades in content
export function ContentTransition({
  loading,
  skeleton,
  children,
  className = '',
  minHeight = 'auto'
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  minHeight?: string;
}) {
  return (
    <div className={cn('relative', className)} style={{ minHeight }}>
      <motion.div
        initial={false}
        animate={{ 
          opacity: loading ? 1 : 0,
          pointerEvents: loading ? 'auto' : 'none'
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-0"
      >
        {skeleton}
      </motion.div>
      <motion.div
        initial={false}
        animate={{ 
          opacity: loading ? 0 : 1,
        }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: loading ? 0 : 0.1 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
