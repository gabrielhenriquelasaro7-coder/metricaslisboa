import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
  Building2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// CRM logos/icons (usando cores representativas)
const CRM_OPTIONS = [
  {
    id: 'kommo',
    name: 'Kommo',
    description: 'CRM focado em vendas com automação de WhatsApp',
    color: 'bg-blue-500',
    salesType: ['inside_sales', 'ecommerce'],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Plataforma completa de marketing, vendas e serviços',
    color: 'bg-orange-500',
    salesType: ['inside_sales', 'ecommerce'],
  },
  {
    id: 'gohighlevel',
    name: 'GoHighLevel',
    description: 'CRM com automação de marketing integrada',
    color: 'bg-green-500',
    salesType: ['inside_sales', 'ecommerce'],
  },
  {
    id: 'bitrix24',
    name: 'Bitrix24',
    description: 'Suite de colaboração com CRM integrado',
    color: 'bg-cyan-500',
    salesType: ['inside_sales', 'ecommerce'],
  },
  {
    id: 'rdstation',
    name: 'RD Station',
    description: 'Plataforma brasileira de automação de marketing',
    color: 'bg-purple-500',
    salesType: ['inside_sales', 'ecommerce'],
  },
  {
    id: 'outros',
    name: 'Outros',
    description: 'Conexão personalizada com outro CRM',
    color: 'bg-muted',
    salesType: ['inside_sales', 'ecommerce'],
  },
];

const SALES_TYPES = [
  { id: 'inside_sales', name: 'Inside Sales', icon: Users },
  { id: 'ecommerce', name: 'E-commerce / PDV', icon: Building2 },
];

export default function Financial() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [selectedSalesType, setSelectedSalesType] = useState<string | null>(null);
  const [connectedCRM, setConnectedCRM] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  // Check authorization
  const ALLOWED_EMAIL = 'gabrielhenriquelasaro7@gmail.com';
  const isAuthorized = user?.email === ALLOWED_EMAIL;

  useEffect(() => {
    if (!authLoading && !isAuthorized) {
      navigate('/dashboard');
    }
  }, [authLoading, isAuthorized, navigate]);

  if (authLoading) {
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

  const handleConnectCRM = async (crmId: string) => {
    setIsConnecting(crmId);
    
    // Simula conexão (futuramente será OAuth ou API key)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setConnectedCRM(crmId);
    setIsConnecting(null);
  };

  const handleDisconnect = () => {
    setConnectedCRM(null);
    setSelectedSalesType(null);
  };

  const connectedCRMData = CRM_OPTIONS.find(c => c.id === connectedCRM);

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
          
          <Badge variant="outline" className="w-fit gap-1.5">
            <AlertCircle className="w-3 h-3" />
            Em desenvolvimento - Apenas visualização
          </Badge>
        </div>

        {/* Se já conectou um CRM, mostra o dashboard financeiro */}
        {connectedCRM ? (
          <div className="space-y-6">
            {/* Connected CRM Card */}
            <Card className="border-primary/20 bg-primary/5">
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
                    <CardDescription>Conectado • {selectedSalesType === 'inside_sales' ? 'Inside Sales' : 'E-commerce / PDV'}</CardDescription>
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
            {/* Passo 1: Escolher tipo de venda */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    1
                  </span>
                  Tipo de Operação
                </CardTitle>
                <CardDescription>
                  Selecione o modelo de vendas do seu cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {SALES_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedSalesType(type.id)}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-200',
                        selectedSalesType === type.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className={cn(
                        'p-3 rounded-lg',
                        selectedSalesType === type.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}>
                        <type.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{type.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {type.id === 'inside_sales' 
                            ? 'Vendas consultivas B2B ou B2C' 
                            : 'Loja online ou ponto de venda'}
                        </p>
                      </div>
                      {selectedSalesType === type.id && (
                        <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Passo 2: Conectar CRM */}
            {selectedSalesType && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      2
                    </span>
                    Conectar CRM
                  </CardTitle>
                  <CardDescription>
                    Escolha o CRM utilizado pelo cliente para sincronizar os dados de vendas
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
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
