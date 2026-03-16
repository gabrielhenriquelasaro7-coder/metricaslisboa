import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import v4LogoIcon from '@/assets/v4-logo-icon.png';
import { CircularLoader } from '@/components/ui/loading-screen';

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

// Loading wrapper - shows V4 logo loader
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
    return createPortal(
      <div 
        className={cn("flex flex-col items-center justify-center bg-background", className)} 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}
      >
        <CircularLoader size={90} />
        <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase mt-6">CARREGANDO...</p>
      </div>,
      document.body
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
