import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects, BusinessModel, Project } from '@/hooks/useProjects';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const projectSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  ad_account_id: z.string().min(1, 'ID da conta é obrigatório'),
  business_model: z.enum(['inside_sales', 'ecommerce', 'pdv']),
  timezone: z.string().min(1),
  currency: z.string().min(1),
});

const businessModels: { value: BusinessModel; label: string; description: string }[] = [
  { value: 'inside_sales', label: 'Inside Sales', description: 'Geração de leads e vendas internas' },
  { value: 'ecommerce', label: 'E-commerce', description: 'Vendas online com foco em ROAS' },
  { value: 'pdv', label: 'PDV', description: 'Tráfego para loja física' },
];

const timezones = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'Europe/London', label: 'Londres (GMT+0)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (GMT+0)' },
];

const currencies = [
  { value: 'BRL', label: 'Real (R$)' },
  { value: 'USD', label: 'Dólar (US$)' },
  { value: 'EUR', label: 'Euro (€)' },
];

interface EditProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { updateProject } = useProjects();

  const [formData, setFormData] = useState({
    name: '',
    ad_account_id: '',
    business_model: 'ecommerce' as BusinessModel,
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
  });

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        ad_account_id: project.ad_account_id,
        business_model: project.business_model,
        timezone: project.timezone,
        currency: project.currency,
      });
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!project) return;

    try {
      projectSchema.parse(formData);
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);
    try {
      await updateProject(project.id, formData);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Editar projeto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome do projeto</Label>
            <Input
              id="edit-name"
              placeholder="Minha loja virtual"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-ad_account_id">ID da conta de anúncios</Label>
            <Input
              id="edit-ad_account_id"
              placeholder="act_123456789"
              value={formData.ad_account_id}
              onChange={(e) => setFormData({ ...formData, ad_account_id: e.target.value })}
            />
            {errors.ad_account_id && <p className="text-sm text-destructive">{errors.ad_account_id}</p>}
          </div>

          <div className="space-y-2">
            <Label>Modelo de negócio</Label>
            <div className="grid grid-cols-1 gap-3">
              {businessModels.map((model) => (
                <button
                  key={model.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, business_model: model.value })}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    formData.business_model === model.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium">{model.label}</p>
                  <p className="text-sm text-muted-foreground">{model.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fuso horário</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.value} value={curr.value}>
                      {curr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gradient" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}