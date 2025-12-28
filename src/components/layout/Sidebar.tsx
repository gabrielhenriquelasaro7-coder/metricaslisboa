import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { 
  BarChart3, 
  LayoutDashboard, 
  FolderKanban, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Megaphone,
  ImageIcon,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campanhas', href: '/campaigns', icon: Megaphone },
  { name: 'Criativos', href: '/creatives', icon: ImageIcon },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { projects } = useProjects();
  
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleChangeProject = (projectId: string) => {
    localStorage.setItem('selectedProjectId', projectId);
    window.location.reload(); // Reload to refresh all data
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <Link to="/projects" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-primary-foreground" />
            </div>
            {!collapsed && <span className="text-lg font-bold">MetaMetrics</span>}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="flex-shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Project Selector */}
        {selectedProject && !collapsed && (
          <div className="px-3 py-3 border-b border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">Projeto</p>
                    <p className="font-medium truncate">{selectedProject.name}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {projects.map((project) => (
                  <DropdownMenuItem 
                    key={project.id}
                    onClick={() => handleChangeProject(project.id)}
                    className={project.id === selectedProject.id ? 'bg-primary/10' : ''}
                  >
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {project.ad_account_id.replace('act_', '')}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => navigate('/projects')} className="border-t mt-1 pt-2">
                  <FolderKanban className="w-4 h-4 mr-2" />
                  Gerenciar Projetos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href === '/campaigns' && location.pathname.includes('/campaign')) ||
              (item.href === '/campaigns' && location.pathname.includes('/adset'));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'sidebar-item',
                  isActive && 'active'
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary-foreground">
                {user?.email?.[0].toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn('mt-4 w-full', collapsed ? 'px-0' : '')}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
