import { useState } from 'react';
import { 
  CheckCircle2, 
  Loader2,
  Star,
  Zap,
  Download,
  ExternalLink,
  Key,
  Link2,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CRMOption {
  id: string;
  name: string;
  description: string;
  color: string;
  badge?: 'popular' | 'recommended' | 'new';
  features?: string[];
  authType: 'api_key' | 'oauth';
  requiresUrl?: boolean;
  urlPlaceholder?: string;
}

const CRM_OPTIONS: CRMOption[] = [
  {
    id: 'kommo',
    name: 'Kommo',
    description: 'CRM focado em vendas com automação de WhatsApp',
    color: 'bg-blue-500',
    badge: 'popular',
    features: ['WhatsApp', 'Pipeline', 'Automações'],
    authType: 'api_key',
    requiresUrl: true,
    urlPlaceholder: 'suaempresa'
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Plataforma completa de marketing e vendas',
    color: 'bg-orange-500',
    badge: 'recommended',
    features: ['CRM gratuito', 'Marketing', 'Sales'],
    authType: 'oauth'
  },
  {
    id: 'bitrix24',
    name: 'Bitrix24',
    description: 'Suite de colaboração com CRM integrado',
    color: 'bg-cyan-500',
    features: ['Colaboração', 'Projetos', 'Telefonia'],
    authType: 'api_key',
    requiresUrl: true,
    urlPlaceholder: 'suaempresa.bitrix24.com.br'
  },
];

interface CRMConnectionCardProps {
  projectName: string;
  onConnect: (crmId: string, credentials?: { api_key: string; api_url?: string }) => Promise<void>;
  connectedCRM?: string | null;
  onDisconnect?: () => void;
  isConnecting?: boolean;
  connectionError?: string | null;
  crmStats?: {
    total_deals: number;
    won_deals: number;
    lost_deals: number;
    open_deals: number;
    total_revenue: number;
    total_pipeline_value: number;
  };
  lastSyncAt?: string | null;
  crmUrl?: string | null;
}

export function CRMConnectionCard({
  projectName,
  onConnect,
  connectedCRM,
  onDisconnect,
  isConnecting,
  connectionError,
  crmStats,
  crmUrl
}: CRMConnectionCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedCRM, setSelectedCRM] = useState<CRMOption | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const connectedCRMData = CRM_OPTIONS.find(c => c.id === connectedCRM);

  const handleOpenModal = (crm: CRMOption) => {
    if (crm.authType === 'oauth') {
      onConnect(crm.id);
      return;
    }
    
    setSelectedCRM(crm);
    setApiKey('');
    setApiUrl('');
    setLocalError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCRM(null);
    setApiKey('');
    setApiUrl('');
    setLocalError(null);
  };

  const handleSubmit = async () => {
    if (!selectedCRM) return;

    if (!apiKey.trim()) {
      setLocalError('Token de acesso é obrigatório');
      return;
    }

    if (selectedCRM.requiresUrl && !apiUrl.trim()) {
      setLocalError('Subdomínio é obrigatório');
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);

    try {
      let formattedUrl = apiUrl.trim();
      if (selectedCRM.id === 'kommo' && formattedUrl) {
        formattedUrl = formattedUrl.replace(/\.kommo\.com\/?$/i, '');
        formattedUrl = `https://${formattedUrl}.kommo.com`;
      }

      await onConnect(selectedCRM.id, {
        api_key: apiKey.trim(),
        api_url: formattedUrl || undefined
      });
      
      handleCloseModal();
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Connected state
  if (connectedCRM && connectedCRMData) {
    const formatCurrency = (value: number) => {
      if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
      return `R$ ${value.toFixed(0)}`;
    };

    return (
      <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 via-transparent to-transparent">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg',
              connectedCRMData.color
            )}>
              {connectedCRMData.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{connectedCRMData.name}</CardTitle>
                <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Conectado
                </Badge>
              </div>
              <CardDescription className="mt-1">
                Sincronizando com <strong>{projectName}</strong>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => crmUrl && window.open(crmUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              Abrir CRM
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onDisconnect}
              className="text-muted-foreground hover:text-destructive"
            >
              Desconectar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-card border">
              <p className="text-2xl font-bold text-foreground">{crmStats?.total_deals || 0}</p>
              <p className="text-sm text-muted-foreground">Deals Total</p>
            </div>
            <div className="p-4 rounded-xl bg-card border">
              <p className="text-2xl font-bold text-green-500">{crmStats?.won_deals || 0}</p>
              <p className="text-sm text-muted-foreground">Vendas Ganhas</p>
            </div>
            <div className="p-4 rounded-xl bg-card border">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(crmStats?.total_revenue || 0)}</p>
              <p className="text-sm text-muted-foreground">Faturamento</p>
            </div>
            <div className="p-4 rounded-xl bg-card border">
              <p className="text-2xl font-bold text-primary">{formatCurrency(crmStats?.total_pipeline_value || 0)}</p>
              <p className="text-sm text-muted-foreground">Pipeline</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </span>
            Conecte seu CRM
          </CardTitle>
          <CardDescription className="ml-11">
            Sincronize os dados de vendas de <strong>{projectName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {CRM_OPTIONS.map((crm) => (
              <Card key={crm.id} className="relative hover:shadow-lg hover:border-primary/40 transition-all">
                {crm.badge && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <Badge className={cn(
                      'gap-1 shadow-sm',
                      crm.badge === 'popular' && 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                      crm.badge === 'recommended' && 'bg-primary/10 text-primary border-primary/20'
                    )}>
                      {crm.badge === 'popular' && <Star className="w-3 h-3" />}
                      {crm.badge === 'recommended' && <Zap className="w-3 h-3" />}
                      {crm.badge === 'popular' ? 'Mais usado' : 'Recomendado'}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md',
                      crm.color
                    )}>
                      {crm.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{crm.name}</CardTitle>
                      {crm.authType === 'api_key' && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          Via Token
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-5 space-y-4">
                  <p className="text-sm text-muted-foreground min-h-[40px]">
                    {crm.description}
                  </p>
                  
                  {crm.features && (
                    <div className="flex flex-wrap gap-1.5">
                      {crm.features.map((feature) => (
                        <Badge key={feature} variant="secondary" className="text-xs font-normal">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <Button 
                    className="w-full gap-2 h-11 font-medium" 
                    disabled={isConnecting}
                    onClick={() => handleOpenModal(crm)}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Conectar
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Conexão */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selectedCRM && (
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md',
                  selectedCRM.color
                )}>
                  {selectedCRM.name.charAt(0)}
                </div>
              )}
              <div>
                <DialogTitle className="text-xl">Conectar {selectedCRM?.name}</DialogTitle>
                <DialogDescription>
                  Preencha os dados para importar automaticamente
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Tutorial Kommo */}
            {selectedCRM?.id === 'kommo' && (
              <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  Como obter o Token do Kommo
                </div>
                <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside pl-1">
                  <li>Dentro do Kommo vá em <strong>Configurações</strong></li>
                  <li>Clique em <strong>Integrações</strong></li>
                  <li>Abra a integração que você criou</li>
                  <li>Ache a opção <strong>"Token de longa duração"</strong></li>
                  <li>Clique em <strong>Gerar</strong> (1 ano ou mais)</li>
                  <li>Copie o token</li>
                </ol>
              </div>
            )}

            {/* Campo Subdomínio */}
            {selectedCRM?.requiresUrl && (
              <div className="space-y-2">
                <Label htmlFor="api_url" className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-muted-foreground" />
                  {selectedCRM.id === 'kommo' ? 'Subdomínio' : 'URL'}
                </Label>
                {selectedCRM.id === 'kommo' ? (
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-muted border border-r-0 rounded-l-md text-sm text-muted-foreground">
                      https://
                    </span>
                    <Input
                      id="api_url"
                      placeholder={selectedCRM.urlPlaceholder}
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="rounded-none border-x-0"
                    />
                    <span className="px-3 py-2 bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground">
                      .kommo.com
                    </span>
                  </div>
                ) : (
                  <Input
                    id="api_url"
                    placeholder={selectedCRM.urlPlaceholder}
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                )}
              </div>
            )}

            {/* Campo Token */}
            <div className="space-y-2">
              <Label htmlFor="api_key" className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                Token de Acesso
              </Label>
              <div className="relative">
                <Input
                  id="api_key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Cole seu token aqui"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Erro */}
            {(localError || connectionError) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{localError || connectionError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseModal} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || !apiKey.trim() || (selectedCRM?.requiresUrl && !apiUrl.trim())}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Conectar e Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
