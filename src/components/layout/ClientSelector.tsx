import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, FolderKanban, Check, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge';

interface ClientSelectorProps {
  onSelect?: () => void;
}

export function ClientSelector({ onSelect }: ClientSelectorProps) {
  const { t } = useTranslation();
  const { projects } = useProjects();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const filteredProjects = useMemo(() => {
    const active = projects.filter(p => !p.archived);
    if (!search.trim()) return active;
    const q = search.toLowerCase();
    return active.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const handleSelect = (projectId: string) => {
    if (projectId === selectedProjectId) {
      setOpen(false);
      return;
    }
    localStorage.setItem('selectedProjectId', projectId);
    setOpen(false);
    setSearch('');
    window.location.reload();
    onSelect?.();
  };

  const statusColor = (score: string | null) => {
    if (score === 'safe') return 'bg-emerald-500';
    if (score === 'care') return 'bg-amber-500';
    if (score === 'danger') return 'bg-destructive';
    return 'bg-muted-foreground';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-lg border border-border/50 bg-card/50",
          "hover:bg-card hover:border-border transition-all duration-200 group"
        )}>
          {/* Project avatar */}
          <div className="w-7 h-7 rounded-md bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
            {selectedProject?.avatar_url ? (
              <img src={selectedProject.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-foreground">
                {selectedProject?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold truncate text-foreground max-w-[160px]">
              {selectedProject?.name || t('sidebar.selectProject')}
            </p>
            {selectedProject && (
              <div className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', statusColor(selectedProject.health_score || null))} />
                <span className="text-[11px] text-muted-foreground">
                  {selectedProject.business_model === 'inside_sales' ? 'Inside Sales' :
                   selectedProject.business_model === 'ecommerce' ? 'E-commerce' :
                   selectedProject.business_model === 'pdv' ? 'PDV' :
                   selectedProject.business_model === 'infoproduto' ? 'Infoproduto' :
                   selectedProject.business_model || 'Projeto'}
                </span>
              </div>
            )}
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
            open && 'rotate-180'
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0 bg-popover border-border z-[60]">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search') + '...'}
              className="h-9 pl-9 text-sm bg-secondary/50 border-border"
              autoFocus
            />
          </div>
        </div>

        {/* Project list */}
        <div className="max-h-[320px] overflow-y-auto py-1">
          {filteredProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('sidebar.noCampaignsFound')}
            </p>
          ) : (
            filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60',
                  project.id === selectedProjectId && 'bg-primary/8'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {project.avatar_url ? (
                    <img src={project.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-foreground">
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusColor(project.health_score))} />
                    <span className="text-sm font-medium text-foreground truncate">{project.name}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {project.business_model === 'inside_sales' ? 'Inside Sales' :
                     project.business_model === 'ecommerce' ? 'E-commerce' :
                     project.business_model === 'pdv' ? 'PDV' :
                     project.business_model === 'infoproduto' ? 'Infoproduto' :
                     project.business_model || ''}
                  </span>
                </div>
                {project.id === selectedProjectId && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Sync status + manage */}
        <div className="border-t border-border">
          {selectedProjectId && (
            <div className="px-3 py-2 border-b border-border">
              <SyncStatusBadge projectId={selectedProjectId} />
            </div>
          )}
          <button
            onClick={() => { setOpen(false); navigate('/settings'); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {t('sidebar.manageProjects')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
