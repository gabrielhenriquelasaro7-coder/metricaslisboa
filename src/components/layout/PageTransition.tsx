import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
  },
  out: {
    opacity: 0,
  },
};

const pageTransition: Transition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.2,
};

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Simple fade wrapper for individual components - smoother
export function FadeIn({ 
  children, 
  delay = 0,
  className = '' 
}: { 
  children: ReactNode; 
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.25, 
        delay,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered children animation - faster
export function StaggerContainer({ 
  children,
  className = '',
  staggerDelay = 0.03
}: { 
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.05,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ 
  children,
  className = ''
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 6 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1]
          }
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Loading wrapper - shows infinity loader instead of skeleton
export function SmoothLoader({ 
  loading, 
  children,
  skeleton,
  className = ''
}: { 
  loading: boolean;
  children: ReactNode;
  skeleton?: ReactNode;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={cn("min-h-[60vh] flex flex-col items-center justify-center", className)}>
        <div className="relative w-16 h-10">
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
        <p className="text-sm text-muted-foreground tracking-widest mt-4">Carregando...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
