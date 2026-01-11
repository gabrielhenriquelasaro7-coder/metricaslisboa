import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Target,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  ShoppingCart,
  Store
} from 'lucide-react';
import { cn } from '@/lib/utils';

// CRM logos/icons (usando cores representativas)
const CRM_OPTIONS = [
  {
    id: 'kommo',
    name: 'Kommo',
    description: 'CRM focado em vendas com automação de WhatsApp',
    color: 'bg-blue-500',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Plataforma completa de marketing, vendas e serviços',
    color: 'bg-orange-500',
  },
  {
    id: 'gohighlevel',
    name: 'GoHighLevel',
    description: 'CRM com automação de marketing integrada',
    color: 'bg-green-500',
  },
  {
    id: 'bitrix24',
    name: 'Bitrix24',
    description: 'Suite de colaboração com CRM integrado',
    color: 'bg-cyan-500',
  },
  {
    id: 'rdstation',
    name: 'RD Station',
    description: 'Plataforma brasileira de automação de marketing',
    color: 'bg-purple-500',
  },
  {
    id: 'outros',
    name: 'Outros',
    description: 'Conexão personalizada com outro CRM',
    color: 'bg-muted',
  },
];

const BUSINESS_MODEL_LABELS: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  inside_sales: { 
    label: 'Inside Sales', 
    icon: Users, 
    description: 'Vendas consultivas B2B ou B2C' 
  },
  ecommerce: { 
    label: 'E-commerce', 
    icon: ShoppingCart, 
    description: 'Loja online com vendas diretas' 
  },
  pdv: { 
    label: 'PDV', 
    icon: Store, 
    description: 'Ponto de Venda físico' 
  },
};

// Modelos de negócio permitidos para o módulo financeiro
const ALLOWED_BUSINESS_MODELS = ['inside_sales', 'ecommerce', 'pdv'];

export default function Financial() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  
  const [connectedCRM, setConnectedCRM] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  // Get selected project from localStorage
  const selectedProjectId = localStorage.getItem('selectedProjectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const businessModel = selectedProject?.business_model;

  // Check authorization
  const ALLOWED_EMAIL = 'gabrielhenriquelasaro7@gmail.com';
  const isAuthorized = user?.email === ALLOWED_EMAIL;

  // Check if business model is allowed
  const isBusinessModelAllowed = businessModel && ALLOWED_BUSINESS_MODELS.includes(businessModel);
  const businessModelInfo = businessModel ? BUSINESS_MODEL_LABELS[businessModel] : null;

  useEffect(() => {
    if (!authLoading && !isAuthorized) {
      navigate('/dashboard');
    }
  }, [authLoading, isAuthorized, navigate]);

  if (authLoading || projectsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  // Se não tem projeto selecionado
  if (!selectedProject) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Nenhum projeto selecionado</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Selecione um projeto na barra lateral para acessar o módulo financeiro.
          </p>
          <Button onClick={() => navigate('/projects')}>
            Ir para Projetos
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Se o modelo de negócio não é permitido
  if (!isBusinessModelAllowed) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h2 className="text-xl font-semibold">Módulo não disponível</h2>
          <p className="text-muted-foreground text-center max-w-md">
            O módulo financeiro está disponível apenas para projetos com modelo de negócio 
            <strong> Inside Sales</strong>, <strong>E-commerce</strong> ou <strong>PDV</strong>.
          </p>
          <Badge variant="outline" className="text-base px-4 py-2">
            Modelo atual: {businessModel === 'custom' ? 'Personalizado' : businessModel === 'infoproduto' ? 'Infoproduto' : businessModel}
          </Badge>
        </div>
      </DashboardLayout>
    );
  }

  const handleConnectCRM = async (crmId: string) => {
    setIsConnecting(crmId);
    
    // Simula conexão (futuramente será OAuth ou API key)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setConnectedCRM(crmId);
    setIsConnecting(null);
  };

  const handleDisconnect = () => {
    setConnectedCRM(null);
  };

  const connectedCRMData = CRM_OPTIONS.find(c => c.id === connectedCRM);
  const BusinessModelIcon = businessModelInfo?.icon || Users;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
              <p className="text-muted-foreground">
                Conecte seu CRM para monitorar vendas, MQL, SQL e métricas financeiras
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Em desenvolvimento
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <BusinessModelIcon className="w-3 h-3" />
              {businessModelInfo?.label}
            </Badge>
            <Badge className="gap-1.5 bg-primary/10 text-primary border-primary/20">
              {selectedProject.name}
            </Badge>
          </div>
        </div>

        {/* Modelo de negócio detectado */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                <BusinessModelIcon className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{businessModelInfo?.label}</CardTitle>
                <CardDescription>{businessModelInfo?.description}</CardDescription>
              </div>
              <CheckCircle2 className="w-5 h-5 text-metric-positive ml-auto" />
            </div>
          </CardHeader>
        </Card>

        {/* Se já conectou um CRM, mostra o dashboard financeiro */}
        {connectedCRM ? (
          <div className="space-y-6">
            {/* Connected CRM Card */}
            <Card className="border-metric-positive/20 bg-metric-positive/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold', connectedCRMData?.color)}>
                    {connectedCRMData?.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {connectedCRMData?.name}
                      <CheckCircle2 className="w-4 h-4 text-metric-positive" />
                    </CardTitle>
                    <CardDescription>Conectado • {businessModelInfo?.label}</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </CardHeader>
            </Card>

            {/* Métricas Financeiras (placeholder) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ 0,00</div>
                  <p className="text-xs text-muted-foreground">Aguardando dados do CRM</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">MQL</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Marketing Qualified Leads</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">SQL</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Sales Qualified Leads</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Margem</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0%</div>
                  <p className="text-xs text-muted-foreground">Margem de Contribuição</p>
                </CardContent>
              </Card>
            </div>

            {/* DRE Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Demonstração de Resultado (DRE)</CardTitle>
                <CardDescription>
                  Visão financeira simplificada do projeto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Receita Bruta</span>
                    <span>R$ 0,00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b text-muted-foreground">
                    <span className="pl-4">(-) Deduções</span>
                    <span>R$ 0,00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b font-medium">
                    <span>Receita Líquida</span>
                    <span>R$ 0,00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b text-muted-foreground">
                    <span className="pl-4">(-) Custo de Aquisição (CAC)</span>
                    <span>R$ 0,00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b font-medium">
                    <span>Margem de Contribuição</span>
                    <span>R$ 0,00</span>
                  </div>
                  <div className="flex justify-between py-2 border-b text-muted-foreground">
                    <span className="pl-4">(-) Despesas Operacionais</span>
                    <span>R$ 0,00</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-lg">
                    <span>EBITDA</span>
                    <span>R$ 0,00</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Conectar CRM */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    1
                  </span>
                  Conectar CRM
                </CardTitle>
                <CardDescription>
                  Escolha o CRM utilizado por <strong>{selectedProject.name}</strong> para sincronizar os dados de vendas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {CRM_OPTIONS.map((crm) => (
                    <Card 
                      key={crm.id}
                      className={cn(
                        'cursor-pointer transition-all duration-200 hover:shadow-md',
                        isConnecting === crm.id && 'opacity-75'
                      )}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold', crm.color)}>
                            {crm.name.charAt(0)}
                          </div>
                          <div>
                            <CardTitle className="text-base">{crm.name}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground mb-4">
                          {crm.description}
                        </p>
                        <Button 
                          className="w-full gap-2" 
                          variant={crm.id === 'outros' ? 'outline' : 'default'}
                          onClick={() => handleConnectCRM(crm.id)}
                          disabled={isConnecting !== null}
                        >
                          {isConnecting === crm.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                              Conectando...
                            </>
                          ) : (
                            <>
                              Conectar
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
