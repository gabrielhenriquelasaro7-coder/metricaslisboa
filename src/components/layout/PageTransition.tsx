import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import v4LogoIcon from '@/assets/v4-logo-icon.png';

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -10,
  },
};

const pageTransition: Transition = {
  duration: 0.35,
  ease: [0.23, 1, 0.32, 1],
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.23, 1, 0.32, 1]
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
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.23, 1, 0.32, 1]
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
            src={v4LogoIcon}
            alt="V4"
            className="w-10 h-10 object-contain brightness-0 invert opacity-90"
          />
        </div>
        <p className="text-[10px] text-white/50 uppercase tracking-[0.3em] font-medium mt-8">Carregando...</p>
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
