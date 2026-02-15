import DashboardLayout from '@/components/layout/DashboardLayout';
import { BarChart3 } from 'lucide-react';

export default function Analytics() {
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 sm:p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Google Analytics
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mb-4">
            Integração com Google Analytics 4 em breve.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Em desenvolvimento
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
