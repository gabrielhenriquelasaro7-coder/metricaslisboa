import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const shimmer = {
  hidden: { x: '-100%' },
  visible: { x: '100%' },
};

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden bg-muted/40 rounded-md', className)}>
      <motion.div
        variants={shimmer}
        initial="hidden"
        animate="visible"
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
          repeatDelay: 0.3,
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
      />
    </div>
  );
}

export function CreativesSkeleton() {
  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <SkeletonBox className="h-8 w-56" />
          <SkeletonBox className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonBox className="h-10 w-44" />
          <SkeletonBox className="h-10 w-64" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SkeletonBox className="h-10 w-64 flex-1 max-w-md" />
        <SkeletonBox className="h-10 w-36" />
        <SkeletonBox className="h-10 w-36" />
        <SkeletonBox className="h-10 w-28" />
        <SkeletonBox className="h-10 w-32" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div 
            key={i} 
            className="glass-card p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <SkeletonBox className="h-4 w-4 rounded" />
              <SkeletonBox className="h-3 w-20" />
            </div>
            <SkeletonBox className="h-7 w-24" />
          </motion.div>
        ))}
      </div>

      {/* Creative Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div 
            key={i} 
            className="glass-card overflow-hidden"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.04, duration: 0.3 }}
          >
            {/* Image placeholder */}
            <SkeletonBox className="aspect-square w-full" />
            
            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <SkeletonBox className="h-4 w-3/4" />
                <SkeletonBox className="h-5 w-14 rounded-full" />
              </div>
              
              <div className="space-y-1">
                <SkeletonBox className="h-3 w-32" />
                <SkeletonBox className="h-3 w-40" />
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <SkeletonBox className="h-2.5 w-10" />
                    <SkeletonBox className="h-4 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
