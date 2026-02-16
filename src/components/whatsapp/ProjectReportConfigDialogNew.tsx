import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Users } from 'lucide-react';
import type { ManagerInstance, ReportConfig, WhatsAppGroup } from '@/hooks/useWhatsAppManager';
import type { PlannerConfig } from '@/hooks/useWhatsAppPlannerConfig';
import { GTReportTab } from './GTReportTab';
import { AccountPlannerTab } from './AccountPlannerTab';

export { ProjectReportConfigDialog as ProjectReportConfigDialogNew };

interface Project {
  id: string;
  name: string;
  business_model: string;
}

interface ProjectReportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  instances: ManagerInstance[];
  existingConfig?: ReportConfig;
  existingPlannerConfig?: PlannerConfig;
  onSave: (config: Partial<ReportConfig> & { project_id: string }) => Promise<boolean>;
  onSavePlanner: (config: Partial<PlannerConfig> & { project_id: string }) => Promise<boolean>;
  onListGroups: (instanceId: string) => Promise<WhatsAppGroup[]>;
}

export function ProjectReportConfigDialog({
  open,
  onOpenChange,
  project,
  instances,
  existingConfig,
  existingPlannerConfig,
  onSave,
  onSavePlanner,
  onListGroups,
}: ProjectReportConfigDialogProps) {
  const [activeTab, setActiveTab] = useState<'gt' | 'account'>('gt');

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab('gt');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl min-h-[70vh] max-h-[90vh] flex flex-col overflow-hidden bg-background/95 backdrop-blur-xl border-border shadow-2xl [&>button]:z-50">
        <DialogHeader className="flex-shrink-0 pb-4 border-b border-border/50">
          <DialogTitle className="text-lg sm:text-xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Configurar WhatsApp — {project.name}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Configure o envio automático de relatórios e planner para este projeto
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'gt' | 'account')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0 h-12 sm:h-14 p-1 bg-secondary/50">
            <TabsTrigger
              value="gt"
              className="flex items-center gap-2 sm:gap-3 h-full data-[state=active]:bg-green-500/15 data-[state=active]:border data-[state=active]:border-green-500/40 data-[state=active]:shadow-sm transition-all"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold">GT Report</p>
                <p className="text-[9px] text-muted-foreground">Relatório + Saldo</p>
              </div>
              <span className="sm:hidden text-xs font-semibold">GT</span>
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="flex items-center gap-2 sm:gap-3 h-full data-[state=active]:bg-blue-500/15 data-[state=active]:border data-[state=active]:border-blue-500/40 data-[state=active]:shadow-sm transition-all"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold">Account Planner</p>
                <p className="text-[9px] text-muted-foreground">Planner Monday</p>
              </div>
              <span className="sm:hidden text-xs font-semibold">Planner</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 pr-2 -mr-2">
            <TabsContent value="gt" className="mt-0 data-[state=inactive]:hidden">
              <div className="border-l-2 border-l-green-500/40 pl-4">
                <GTReportTab
                  project={project}
                  instances={instances}
                  existingConfig={existingConfig}
                  onSave={onSave}
                  onListGroups={onListGroups}
                  onClose={() => onOpenChange(false)}
                />
              </div>
            </TabsContent>

            <TabsContent value="account" className="mt-0 data-[state=inactive]:hidden">
              <div className="border-l-2 border-l-blue-500/40 pl-4">
                <AccountPlannerTab
                  project={project}
                  instances={instances}
                  existingConfig={existingPlannerConfig}
                  onSave={onSavePlanner}
                  onListGroups={onListGroups}
                  onClose={() => onOpenChange(false)}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
