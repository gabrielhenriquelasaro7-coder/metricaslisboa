import { useState } from 'react';
import { 
  CheckCircle2, 
  ArrowRight,
  Loader2,
  Star,
  Zap,
  Download,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CRMOption {
  id: string;
  name: string;
  description: string;
  color: string;
  badge?: 'popular' | 'recommended' | 'new';
  features?: string[];
}

const CRM_OPTIONS: CRMOption[] = [
  {
    id: 'kommo',
    name: 'Kommo',
    description: 'CRM focado em vendas com automação de WhatsApp e funis visuais',
    color: 'bg-blue-500',
    badge: 'popular',
    features: ['WhatsApp integrado', 'Pipeline visual', 'Automações']
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Plataforma completa de marketing, vendas e atendimento ao cliente',
    color: 'bg-orange-500',
    badge: 'recommended',
    features: ['CRM gratuito', 'Marketing Hub', 'Sales Hub']
  },
  {
    id: 'gohighlevel',
    name: 'GoHighLevel',
    description: 'CRM white-label com automação de marketing integrada',
    color: 'bg-green-500',
    features: ['White-label', 'Funis', 'Automação']
  },
  {
    id: 'bitrix24',
    name: 'Bitrix24',
    description: 'Suite completa de colaboração com CRM, projetos e comunicação',
    color: 'bg-cyan-500',
    features: ['Colaboração', 'Projetos', 'Telefonia']
  },
  {
    id: 'rdstation',
    name: 'RD Station',
    description: 'Plataforma brasileira líder em automação de marketing digital',
    color: 'bg-purple-500',
    badge: 'new',
    features: ['Marketing', 'Leads scoring', 'Email marketing']
  },
  {
    id: 'outros',
    name: 'Outro CRM',
    description: 'Conexão personalizada via API ou Webhooks com seu CRM atual',
    color: 'bg-muted',
    features: ['API REST', 'Webhooks', 'Suporte técnico']
  },
];

const BADGE_CONFIG = {
  popular: { label: 'Mais usado', icon: Star, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  recommended: { label: 'Recomendado', icon: Zap, className: 'bg-primary/10 text-primary border-primary/20' },
  new: { label: 'Novo', icon: null, className: 'bg-green-500/10 text-green-500 border-green-500/20' },
};

interface CRMConnectionCardProps {
  projectName: string;
  onConnect: (crmId: string) => Promise<void>;
  connectedCRM?: string | null;
  onDisconnect?: () => void;
  isConnecting?: string | null;
}

export function CRMConnectionCard({
  projectName,
  onConnect,
  connectedCRM,
  onDisconnect,
  isConnecting
}: CRMConnectionCardProps) {
  const connectedCRMData = CRM_OPTIONS.find(c => c.id === connectedCRM);

  if (connectedCRM && connectedCRMData) {
    return (
      <Card className="border-metric-positive/30 bg-gradient-to-br from-metric-positive/5 via-transparent to-transparent">
        <CardHeader className="flex flex-row items-center justify-between">
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
                <Badge className="gap-1 bg-metric-positive/10 text-metric-positive border-metric-positive/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Conectado
                </Badge>
              </div>
              <CardDescription className="mt-1">
                Sincronizando dados com <strong>{projectName}</strong>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
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
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-metric-positive animate-pulse" />
              <span>Última sincronização: agora</span>
            </div>
            <div className="text-muted-foreground">
              Próxima sync: em 5 minutos
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-xl">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </span>
              Conecte seu CRM
            </CardTitle>
            <CardDescription className="mt-2 ml-11">
              Sincronize automaticamente os dados de vendas de <strong>{projectName}</strong>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CRM_OPTIONS.map((crm) => {
            const badgeConfig = crm.badge ? BADGE_CONFIG[crm.badge] : null;
            const BadgeIcon = badgeConfig?.icon;
            
            return (
              <Card 
                key={crm.id}
                className={cn(
                  'relative cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/40 group',
                  isConnecting === crm.id && 'opacity-75 pointer-events-none'
                )}
              >
                {badgeConfig && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <Badge className={cn('gap-1 shadow-sm', badgeConfig.className)}>
                      {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                      {badgeConfig.label}
                    </Badge>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md transition-transform group-hover:scale-105',
                      crm.color
                    )}>
                      {crm.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{crm.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-5 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed min-h-[48px]">
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
                    variant={crm.id === 'outros' ? 'outline' : 'default'}
                    onClick={() => onConnect(crm.id)}
                    disabled={isConnecting !== null}
                  >
                    {isConnecting === crm.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Conectar e importar dados
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
