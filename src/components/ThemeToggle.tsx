import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  collapsed?: boolean;
}

export function ThemeToggle({ className, collapsed }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn(
        'transition-colors duration-200',
        collapsed ? 'w-10 h-10 p-0' : 'w-full justify-start gap-3 px-4',
        className
      )}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-5 h-5 text-primary" />
          {!collapsed && <span>Modo Claro</span>}
        </>
      ) : (
        <>
          <Moon className="w-5 h-5 text-primary" />
          {!collapsed && <span>Modo Escuro</span>}
        </>
      )}
    </Button>
  );
}
