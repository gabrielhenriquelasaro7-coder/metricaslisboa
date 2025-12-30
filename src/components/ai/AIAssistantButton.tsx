import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIAssistantButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export const AIAssistantButton: React.FC<AIAssistantButtonProps> = ({ onClick, isOpen }) => {
  if (isOpen) return null;

  return (
    <Button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'h-14 w-14 rounded-full shadow-lg',
        'bg-primary hover:bg-primary/90',
        'transition-all duration-300 hover:scale-110',
        'flex items-center justify-center'
      )}
    >
      <Sparkles className="h-6 w-6" />
    </Button>
  );
};
