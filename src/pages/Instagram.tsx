import DashboardLayout from '@/components/layout/DashboardLayout';
import { Instagram } from 'lucide-react';

export default function InstagramPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
        <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-secondary">
          <Instagram className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Instagram</h1>
          <p className="text-muted-foreground max-w-md">
            Em breve: métricas de Social Media do Instagram. Acompanhe alcance, engajamento, crescimento de seguidores e muito mais.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          Em desenvolvimento
        </div>
      </div>
    </DashboardLayout>
  );
}
