import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ChartCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartName: string;
  primaryColor: string;
  secondaryColor: string;
  onSave: (name: string, primaryColor: string, secondaryColor: string) => void;
}

const COLOR_PRESETS = [
  { name: 'Azul', color: 'hsl(220, 70%, 50%)' },
  { name: 'Verde', color: 'hsl(142, 76%, 36%)' },
  { name: 'Roxo', color: 'hsl(280, 70%, 50%)' },
  { name: 'Laranja', color: 'hsl(30, 70%, 50%)' },
  { name: 'Rosa', color: 'hsl(340, 70%, 50%)' },
  { name: 'Ciano', color: 'hsl(180, 70%, 45%)' },
  { name: 'Vermelho', color: 'hsl(0, 70%, 50%)' },
  { name: 'Amarelo', color: 'hsl(50, 80%, 45%)' },
];

export function ChartCustomizationDialog({
  open,
  onOpenChange,
  chartName,
  primaryColor,
  secondaryColor,
  onSave,
}: ChartCustomizationDialogProps) {
  const [name, setName] = useState(chartName);
  const [primary, setPrimary] = useState(primaryColor);
  const [secondary, setSecondary] = useState(secondaryColor);

  const handleSave = () => {
    onSave(name, primary, secondary);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Personalizar Gráfico</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="chart-name">Nome do Gráfico</Label>
            <Input
              id="chart-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Análise de ROI"
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Cor Primária</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    primary === preset.color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset.color }}
                  onClick={() => setPrimary(preset.color)}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label>Cor Secundária</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    secondary === preset.color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset.color }}
                  onClick={() => setSecondary(preset.color)}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-2 p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: primary }} />
              <span className="text-sm text-muted-foreground">Métrica 1</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: secondary }} />
              <span className="text-sm text-muted-foreground">Métrica 2</span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
