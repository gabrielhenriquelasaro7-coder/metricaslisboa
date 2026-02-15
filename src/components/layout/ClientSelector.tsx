import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, FolderKanban, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface ClientSelectorProps {
  collapsed?: boolean;
  onSelect?: () => void;
}

export function ClientSelector({ collapsed, onSelect }: ClientSelectorProps) {
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
    navigate('/dashboard');
    onSelect?.();
  };

  const statusDot = (score: string | null) => {
    if (score === 'safe') return 'bg-emerald-500';
    if (score === 'care') return 'bg-amber-500';
    if (score === 'danger') return 'bg-red-500';
    return 'bg-muted-foreground';
  };

  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/50 border border-border hover:bg-secondary transition-colors">
            {selectedProject ? (
              <span className="text-sm font-bold text-foreground">
                {selectedProject.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <FolderKanban className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-72 p-0 bg-popover border-border">
          <ClientList
            projects={filteredProjects}
            selectedId={selectedProjectId}
            search={search}
            onSearchChange={setSearch}
            onSelect={handleSelect}
            onManage={() => { setOpen(false); navigate('/projects'); }}
            statusDot={statusDot}
            t={t}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="sidebar-project-selector w-full flex items-center justify-between group">
          <div className="text-left min-w-0 flex-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full', statusDot(selectedProject?.health_score || null))} />
              {t('sidebar.activeProject')}
            </p>
            <p className="font-semibold truncate mt-0.5 text-foreground text-sm">
              {selectedProject?.name || t('sidebar.selectProject')}
            </p>
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border-border">
        <ClientList
          projects={filteredProjects}
          selectedId={selectedProjectId}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          onManage={() => { setOpen(false); navigate('/projects'); }}
          statusDot={statusDot}
          t={t}
        />
      </PopoverContent>
    </Popover>
  );
}

interface ClientListProps {
  projects: any[];
  selectedId: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (id: string) => void;
  onManage: () => void;
  statusDot: (score: string | null) => string;
  t: (key: string) => string;
}

function ClientList({ projects, selectedId, search, onSearchChange, onSelect, onManage, statusDot, t }: ClientListProps) {
  return (
    <div className="flex flex-col">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('common.search') + '...'}
            className="h-8 pl-8 text-sm bg-secondary/50 border-border"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto py-1">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('sidebar.noCampaignsFound')}
          </p>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/80',
                project.id === selectedId && 'bg-primary/10'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                {project.avatar_url ? (
                  <img src={project.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-foreground">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusDot(project.health_score))} />
                  <span className="text-sm font-medium text-foreground truncate">{project.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {project.business_model === 'inside_sales' ? 'Inside Sales' :
                   project.business_model === 'ecommerce' ? 'E-commerce' :
                   project.business_model === 'pdv' ? 'PDV' :
                   project.business_model === 'infoproduto' ? 'Infoproduto' : 
                   project.business_model || ''}
                </span>
              </div>
              {project.id === selectedId && (
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
      <button
        onClick={onManage}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/80 border-t border-border transition-colors"
      >
        <FolderKanban className="w-4 h-4" />
        {t('sidebar.manageProjects')}
      </button>
    </div>
  );
}
