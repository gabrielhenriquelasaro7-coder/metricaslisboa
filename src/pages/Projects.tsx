import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProjectCard from '@/components/projects/ProjectCard';
import CreateProjectDialog from '@/components/projects/CreateProjectDialog';
import EditProjectDialog from '@/components/projects/EditProjectDialog';
import { useProjects, Project } from '@/hooks/useProjects';
import { Search, FolderKanban, Archive, Download, FileSpreadsheet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { exportProjectsToCSV, exportProjectsToExcel } from '@/utils/exportData';
import { toast } from 'sonner';

type ActionType = 'delete' | 'archive' | 'unarchive';

export default function Projects() {
  const { projects, loading, deleteProject, archiveProject, unarchiveProject } = useProjects();
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase());
    const matchesArchiveFilter = showArchived ? project.archived : !project.archived;
    return matchesSearch && matchesArchiveFilter;
  });

  const handleEdit = (project: Project) => {
    setEditingProject(project);
  };

  const handleDelete = (project: Project) => {
    setSelectedProject(project);
    setActionType('delete');
  };

  const handleArchive = (project: Project) => {
    setSelectedProject(project);
    setActionType('archive');
  };

  const handleUnarchive = (project: Project) => {
    setSelectedProject(project);
    setActionType('unarchive');
  };

  const confirmAction = async () => {
    if (!selectedProject || !actionType) return;

    switch (actionType) {
      case 'delete':
        await deleteProject(selectedProject.id);
        break;
      case 'archive':
        await archiveProject(selectedProject.id);
        break;
      case 'unarchive':
        await unarchiveProject(selectedProject.id);
        break;
    }

    setSelectedProject(null);
    setActionType(null);
  };

  const closeDialog = () => {
    setSelectedProject(null);
    setActionType(null);
  };

  const handleExportCSV = () => {
    exportProjectsToCSV(filteredProjects);
    toast.success('Projetos exportados para CSV!');
  };

  const handleExportExcel = () => {
    exportProjectsToExcel(filteredProjects);
    toast.success('Projetos exportados para Excel!');
  };

  const getDialogContent = () => {
    if (!actionType || !selectedProject) return { title: '', description: '', actionLabel: '', variant: '' };

    switch (actionType) {
      case 'delete':
        return {
          title: 'Excluir projeto',
          description: `Tem certeza que deseja excluir o projeto "${selectedProject.name}"? Esta ação não pode ser desfeita e todos os dados serão perdidos permanentemente.`,
          actionLabel: 'Excluir',
          variant: 'destructive',
        };
      case 'archive':
        return {
          title: 'Arquivar projeto',
          description: `Tem certeza que deseja arquivar o projeto "${selectedProject.name}"? O projeto ficará oculto da lista principal mas pode ser restaurado posteriormente.`,
          actionLabel: 'Arquivar',
          variant: 'default',
        };
      case 'unarchive':
        return {
          title: 'Restaurar projeto',
          description: `Tem certeza que deseja restaurar o projeto "${selectedProject.name}"? O projeto voltará a aparecer na lista principal.`,
          actionLabel: 'Restaurar',
          variant: 'default',
        };
    }
  };

  const dialogContent = getDialogContent();

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Projetos</h1>
            <p className="text-muted-foreground">Gerencie suas contas de anúncios</p>
          </div>
          
          <div className="flex items-center gap-2">
            {filteredProjects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Exportar Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <CreateProjectDialog />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar projetos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(v) => setShowArchived(v === 'archived')}>
            <TabsList>
              <TabsTrigger value="active">Ativos</TabsTrigger>
              <TabsTrigger value="archived">
                <Archive className="w-4 h-4 mr-2" />
                Arquivados
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-secondary rounded" />
                    <div className="h-3 w-20 bg-secondary rounded" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-6 w-24 bg-secondary rounded" />
                  <div className="h-4 w-full bg-secondary rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              {showArchived ? <Archive className="w-8 h-8 text-primary" /> : <FolderKanban className="w-8 h-8 text-primary" />}
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {search 
                ? 'Nenhum projeto encontrado' 
                : showArchived 
                  ? 'Nenhum projeto arquivado'
                  : 'Nenhum projeto ainda'}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {search 
                ? 'Tente buscar com outros termos.'
                : showArchived
                  ? 'Projetos arquivados aparecerão aqui.'
                  : 'Crie seu primeiro projeto para começar a analisar suas campanhas.'}
            </p>
            {!search && !showArchived && <CreateProjectDialog />}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
              />
            ))}
          </div>
        )}

        {/* Edit Project Dialog */}
        <EditProjectDialog
          project={editingProject}
          open={!!editingProject}
          onOpenChange={(open) => !open && setEditingProject(null)}
        />

        {/* Confirmation Dialog */}
        <AlertDialog open={!!selectedProject && !!actionType} onOpenChange={closeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {dialogContent.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmAction}
                className={dialogContent.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              >
                {dialogContent.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}