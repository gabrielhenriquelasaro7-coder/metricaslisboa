import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, Check, Settings } from 'lucide-react';
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/50 bg-card/50",
          "hover:bg-card hover:border-border transition-all duration-200 group max-w-[180px]"
        )}>
          {/* Project avatar */}
          <div className="w-6 h-6 rounded-md bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
            {selectedProject?.avatar_url ? (
              <img src={selectedProject.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-foreground">
                {selectedProject?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <span className="text-xs font-medium truncate text-foreground">
            {selectedProject?.name || t('sidebar.selectProject')}
          </span>
          <ChevronDown className={cn(
            'w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 flex-shrink-0',
            open && 'rotate-180'
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 bg-popover border-border z-[60]">
        {/* Search */}
        <div className="p-2.5 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search') + '...'}
              className="h-8 pl-8 text-xs bg-secondary/50 border-border"
              autoFocus
            />
          </div>
        </div>

        {/* Project list */}
        <div className="max-h-[280px] overflow-y-auto py-1">
          {filteredProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t('sidebar.noCampaignsFound')}
            </p>
          ) : (
            filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-secondary/60',
                  project.id === selectedProjectId && 'bg-primary/8'
                )}
              >
                <div className="w-7 h-7 rounded-md bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {project.avatar_url ? (
                    <img src={project.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-foreground">
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-foreground truncate flex-1">{project.name}</span>
                {project.id === selectedProjectId && (
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Manage */}
        <div className="border-t border-border">
          {selectedProjectId && (
            <div className="px-2.5 py-1.5 border-b border-border">
              <SyncStatusBadge projectId={selectedProjectId} />
            </div>
          )}
          <button
            onClick={() => { setOpen(false); navigate('/settings'); }}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            {t('sidebar.manageProjects')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
