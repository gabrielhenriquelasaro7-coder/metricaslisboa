import { Link } from 'react-router-dom';
import { Project, BusinessModel } from '@/hooks/useProjects';
import { 
  MoreHorizontal, 
  TrendingUp, 
  Users, 
  Store,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const businessModelConfig: Record<BusinessModel, { icon: typeof TrendingUp; label: string; color: string }> = {
  inside_sales: { icon: Users, label: 'Inside Sales', color: 'text-chart-1' },
  ecommerce: { icon: TrendingUp, label: 'E-commerce', color: 'text-chart-3' },
  pdv: { icon: Store, label: 'PDV', color: 'text-chart-4' },
};

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export default function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  const config = businessModelConfig[project.business_model];
  const Icon = config.icon;
  
  const syncStatus = project.webhook_status === 'success' ? 'synced' : project.webhook_status === 'error' ? 'error' : 'pending';

  return (
    <Link to={`/project/${project.id}`} className="block">
      <div className="glass-card-hover p-6 group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center ${config.color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              <p className="text-sm text-muted-foreground">{config.label}</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(project); }}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.preventDefault(); onDelete(project); }}
                className="text-destructive"
              >
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs bg-secondary px-2 py-1 rounded">
              {project.ad_account_id}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                {project.last_sync_at 
                  ? `Sincronizado ${formatDistanceToNow(new Date(project.last_sync_at), { addSuffix: true, locale: ptBR })}`
                  : 'Nunca sincronizado'
                }
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              {syncStatus === 'synced' && (
                <CheckCircle className="w-4 h-4 text-metric-positive" />
              )}
              {syncStatus === 'error' && (
                <AlertCircle className="w-4 h-4 text-metric-negative" />
              )}
              {syncStatus === 'pending' && (
                <RefreshCw className="w-4 h-4 text-metric-warning animate-spin" />
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
