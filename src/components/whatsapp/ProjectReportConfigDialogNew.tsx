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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configurar WhatsApp - {project.name}</DialogTitle>
          <DialogDescription>
            Configure o envio automático de relatórios e planner para este projeto
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'gt' | 'account')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="gt" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              GT (Relatório + Saldo)
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Account (Planner)
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 pr-2 -mr-2">
            <TabsContent value="gt" className="mt-0 data-[state=inactive]:hidden">
              <GTReportTab
                project={project}
                instances={instances}
                existingConfig={existingConfig}
                onSave={onSave}
                onListGroups={onListGroups}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>

            <TabsContent value="account" className="mt-0 data-[state=inactive]:hidden">
              <AccountPlannerTab
                project={project}
                instances={instances}
                existingConfig={existingPlannerConfig}
                onSave={onSavePlanner}
                onListGroups={onListGroups}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
