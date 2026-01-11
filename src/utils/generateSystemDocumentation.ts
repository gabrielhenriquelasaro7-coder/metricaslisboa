import jsPDF from 'jspdf';

interface DocumentationSection {
  title: string;
  content: string;
}

export const generateSystemDocumentation = (): string => {
  const documentation = `
================================================================================
                    DOCUMENTAÇÃO COMPLETA DO SISTEMA
                    V4 TRAFFIC DASHBOARD - TRÁFEGO PAGO
================================================================================
Gerado em: ${new Date().toLocaleString('pt-BR')}
================================================================================

================================================================================
1. VISÃO GERAL DO SISTEMA
================================================================================

Este sistema é um DASHBOARD DE MÉTRICAS DE TRÁFEGO PAGO desenvolvido para 
centralizar, organizar e visualizar métricas de campanhas publicitárias.

FINALIDADE:
- Centralizar métricas de campanhas de múltiplas plataformas
- Organizar dados por PROJETO (cliente)
- Comparar períodos (atual vs anterior)
- Exibir métricas financeiras e de performance
- Gerar relatórios automatizados via WhatsApp
- Análise preditiva com IA

PLATAFORMAS SUPORTADAS:
- Meta Ads (Facebook/Instagram) - Principal
- Google Ads - Integrado
- Estrutura preparada para futuras integrações

STACK TECNOLÓGICO:
- Frontend: React 18 + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui + Radix UI
- Estado: TanStack React Query
- Animações: Framer Motion
- Gráficos: Recharts
- Backend: Supabase (PostgreSQL + Edge Functions)
- Autenticação: Supabase Auth
- Storage: Supabase Storage

================================================================================
2. ARQUITETURA DO SISTEMA
================================================================================

2.1 ESTRUTURA DE PASTAS
-----------------------
src/
├── assets/           # Imagens e recursos estáticos
├── components/       # Componentes React reutilizáveis
│   ├── admin/        # Componentes de administração
│   ├── ai/           # Componentes de IA (assistente)
│   ├── alerts/       # Componentes de alertas
│   ├── auth/         # Componentes de autenticação
│   ├── campaigns/    # Componentes de campanhas
│   ├── catalog/      # Componentes de catálogo
│   ├── dashboard/    # Componentes do dashboard principal
│   ├── filters/      # Componentes de filtros
│   ├── guests/       # Componentes de convidados
│   ├── layout/       # Componentes de layout (Sidebar, etc)
│   ├── leads/        # Componentes de leads
│   ├── optimization/ # Componentes de otimização
│   ├── pdf/          # Componentes de geração de PDF
│   ├── predictive/   # Componentes de análise preditiva
│   ├── projects/     # Componentes de projetos
│   ├── pwa/          # Componentes PWA
│   ├── settings/     # Componentes de configurações
│   ├── skeletons/    # Componentes de loading skeleton
│   ├── sync/         # Componentes de sincronização
│   ├── tour/         # Componentes de tour guiado
│   ├── ui/           # Componentes base (shadcn/ui)
│   └── whatsapp/     # Componentes de WhatsApp
├── hooks/            # Custom hooks React
├── integrations/     # Integrações (Supabase)
├── lib/              # Utilitários
├── pages/            # Páginas da aplicação
└── utils/            # Funções utilitárias

supabase/
├── config.toml       # Configuração do Supabase
└── functions/        # Edge Functions (serverless)

2.2 FLUXO DE DADOS
------------------
Usuário → Frontend (React) → Backend (Supabase Edge Functions) → 
API Externa (Meta/Google) → Backend → PostgreSQL → Frontend

================================================================================
3. SISTEMA DE PROJETOS
================================================================================

3.1 DEFINIÇÃO
-------------
- Um PROJETO representa um CLIENTE
- Cada projeto possui uma ou mais contas de anúncios
- Projetos podem ser arquivados (soft delete)
- Projetos possuem configuração de métricas personalizadas

3.2 CAMPOS DO PROJETO
---------------------
- id: UUID único
- user_id: ID do usuário proprietário
- name: Nome do projeto
- ad_account_id: ID da conta de anúncios Meta
- google_customer_id: ID da conta Google Ads (opcional)
- facebook_page_id: ID da página Facebook (para leads)
- business_model: Modelo de negócio (inside_sales, ecommerce, pdv, infoproduto, custom)
- currency: Moeda (default: BRL)
- timezone: Fuso horário (default: America/Sao_Paulo)
- account_balance: Saldo da conta de anúncios
- health_score: Score de saúde do projeto
- last_sync_at: Última sincronização
- archived: Se está arquivado
- avatar_url: URL do avatar do projeto
- ai_briefing: Briefing para IA

3.3 TABELA: projects
--------------------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  google_customer_id TEXT,
  facebook_page_id TEXT,
  business_model business_model NOT NULL,
  currency TEXT DEFAULT 'BRL',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  account_balance NUMERIC,
  account_balance_updated_at TIMESTAMPTZ,
  health_score TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_progress JSONB,
  webhook_status TEXT,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  avatar_url TEXT,
  ai_briefing TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

================================================================================
4. TABELAS DO BANCO DE DADOS
================================================================================

4.1 MÉTRICAS DIÁRIAS (Principal)
--------------------------------
TABELA: ads_daily_metrics
- Armazena métricas diárias de anúncios
- Chave composta: project_id + ad_id + date
- Campos: spend, impressions, clicks, reach, ctr, cpm, cpc, frequency,
  conversions, conversion_value, cpa, roas, messaging_replies, profile_visits,
  leads_count, purchases_count
- Inclui informações de campanha, adset e ad (nomes, status, IDs)

4.2 CAMPANHAS (Agregado)
------------------------
TABELA: campaigns
- Dados agregados de campanhas
- Status: ACTIVE, PAUSED, ARCHIVED, etc.
- Métricas: spend, impressions, clicks, reach, conversions, etc.
- Orçamento: daily_budget, lifetime_budget
- Objetivo: objective (CONVERSIONS, TRAFFIC, LEADS, etc.)

4.3 CONJUNTOS DE ANÚNCIOS (Agregado)
------------------------------------
TABELA: ad_sets
- Dados agregados de conjuntos de anúncios
- Vinculado a campaign_id
- Inclui targeting (público-alvo)
- Métricas similares às campanhas

4.4 ANÚNCIOS (Agregado)
-----------------------
TABELA: ads
- Dados agregados de anúncios individuais
- Vinculado a campaign_id e ad_set_id
- Inclui dados de criativos:
  - creative_id, creative_image_url, creative_video_url
  - creative_thumbnail, cached_image_url
  - headline, primary_text, cta

4.5 METAS E OBJETIVOS
---------------------
TABELA: account_goals
- Metas globais por projeto
- target_spend_daily, target_spend_monthly
- target_cpc, target_cpl, target_ctr, target_roas
- target_leads_monthly

TABELA: campaign_goals
- Metas por campanha
- target_cpl, target_ctr, target_leads, target_roas, max_cpc

4.6 HISTÓRICO DE OTIMIZAÇÕES
----------------------------
TABELA: optimization_history
- Registra mudanças em campanhas/adsets/ads
- Campos: entity_type, entity_id, field_changed, old_value, new_value
- change_type: created, paused, activated, status_change, targeting_change
- changed_by: Nome do usuário que fez a alteração (via API Activities)

4.7 ALERTAS DE ANOMALIAS
------------------------
TABELA: anomaly_alerts
- Alertas automáticos de anomalias
- Tipos: ctr_drop, cpl_increase, campaign_paused, etc.
- Severidade: warning, critical

TABELA: anomaly_alert_config
- Configuração de alertas por projeto
- Thresholds personalizáveis
- Integração com WhatsApp

4.8 LEADS
---------
TABELA: leads
- Leads capturados via formulários Meta
- Campos: lead_name, lead_email, lead_phone
- field_data: Dados dinâmicos do formulário

TABELA: leadgen_forms
- Formulários de lead disponíveis

4.9 INSIGHTS DEMOGRÁFICOS
-------------------------
TABELA: demographic_insights
- Dados por idade, gênero, região
- breakdown_type: age, gender, region

4.10 GOOGLE ADS
---------------
TABELA: google_campaigns, google_ad_groups, google_ads
TABELA: google_ads_daily_metrics
- Estrutura similar ao Meta Ads
- Inclui campos específicos: campaign_type, bidding_strategy, search_impression_share

4.11 WHATSAPP
-------------
TABELA: whatsapp_instances
- Instâncias WhatsApp por projeto

TABELA: whatsapp_manager_instances
- Instâncias globais do gestor

TABELA: whatsapp_subscriptions
- Assinaturas de relatórios

TABELA: whatsapp_report_configs
- Configurações de relatórios

TABELA: whatsapp_messages_log
- Log de mensagens enviadas

4.12 USUÁRIOS E PERMISSÕES
--------------------------
TABELA: profiles
- Perfil do usuário
- full_name, avatar_url, cargo

TABELA: user_roles
- Roles: admin, gestor, convidado

TABELA: guest_invitations
- Convites para convidados

TABELA: guest_project_access
- Acesso de convidados a projetos

4.13 SINCRONIZAÇÃO
------------------
TABELA: sync_logs
- Log de sincronizações

TABELA: sync_progress
- Progresso de sincronizações longas

TABELA: project_import_months
- Status de importação por mês

4.14 CONFIGURAÇÕES
------------------
TABELA: project_metric_config
- Configuração de métricas por projeto
- primary_metrics, result_metrics, cost_metrics, efficiency_metrics
- result_metric: Métrica principal de resultado

TABELA: chart_preferences
- Preferências de gráficos por usuário

TABELA: system_settings
- Configurações globais do sistema

4.15 CACHE DE IA
----------------
TABELA: ai_analysis_cache
- Cache de respostas da IA
- query_hash para deduplicação
- expires_at para invalidação

================================================================================
5. EDGE FUNCTIONS (ENDPOINTS)
================================================================================

5.1 SINCRONIZAÇÃO META ADS
--------------------------
FUNÇÃO: meta-ads-sync
MÉTODO: POST
CORPO: {
  project_id: string,
  ad_account_id: string,
  date_preset?: string,
  time_range?: { since: string, until: string },
  light_sync?: boolean,
  skip_image_cache?: boolean
}
RETORNO: {
  success: boolean,
  summary: {
    records: number,
    campaigns: number,
    adsets: number,
    ads: number,
    spend: number,
    conversions: number,
    changes: number,
    duration: number
  }
}

5.2 IMPORTAÇÃO HISTÓRICA
------------------------
FUNÇÃO: import-historical-data
MÉTODO: POST
CORPO: {
  project_id: string,
  since: string,
  until?: string,
  safe_mode?: boolean
}

FUNÇÃO: import-month-by-month
- Importação mês a mês para grandes períodos

5.3 SINCRONIZAÇÃO GOOGLE ADS
----------------------------
FUNÇÃO: google-ads-sync
MÉTODO: POST
CORPO: {
  project_id: string,
  date_preset?: string,
  time_range?: { since: string, until: string }
}

5.4 SINCRONIZAÇÃO DE LEADS
--------------------------
FUNÇÃO: meta-leads-sync
MÉTODO: POST
CORPO: {
  project_id: string,
  facebook_page_id: string
}

5.5 SINCRONIZAÇÃO AGENDADA
--------------------------
FUNÇÃO: scheduled-sync
- Executada via cron job diário
- Sincroniza todos os projetos ativos

FUNÇÃO: scheduled-sync-parallel
- Versão paralela para múltiplos projetos

5.6 DETECÇÃO DE GAPS
--------------------
FUNÇÃO: detect-and-fix-gaps
MÉTODO: POST
CORPO: {
  auto_fix?: boolean,
  project_id?: string
}
- Detecta períodos sem dados e reimporta

5.7 ANÁLISE PREDITIVA
---------------------
FUNÇÃO: predictive-analysis
MÉTODO: POST
CORPO: {
  project_id: string,
  business_model: string,
  metrics: object,
  goals: object
}
- Usa IA (Gemini) para análise e sugestões

5.8 ASSISTENTE IA
-----------------
FUNÇÃO: ai-traffic-assistant
MÉTODO: POST
CORPO: {
  project_id: string,
  message: string,
  context?: object
}
- Chatbot de análise de tráfego

5.9 WHATSAPP
------------
FUNÇÃO: whatsapp-instance-manager
- Gerenciamento de instâncias WhatsApp

FUNÇÃO: whatsapp-send
MÉTODO: POST
CORPO: {
  instance_id: string,
  phone_number?: string,
  group_id?: string,
  message: string
}

FUNÇÃO: whatsapp-weekly-report
- Envio de relatórios semanais automáticos

FUNÇÃO: whatsapp-balance-alert
- Alertas de saldo baixo

FUNÇÃO: whatsapp-webhook
- Webhook para receber eventos WhatsApp

5.10 CONVITES
-------------
FUNÇÃO: invite-guest
MÉTODO: POST
CORPO: {
  guest_email: string,
  guest_name: string,
  project_id: string
}

5.11 IMAGENS DE CATÁLOGO
------------------------
FUNÇÃO: fetch-catalog-images
MÉTODO: POST
CORPO: {
  project_id: string,
  ad_id: string
}
- Busca imagens de catálogo dinâmico

5.12 DEBUG
----------
FUNÇÃO: debug-ad-creative
- Debug de criativos de anúncios

5.13 SYNC WEBHOOK
-----------------
FUNÇÃO: sync-webhook
- Webhook para disparar sincronizações externas

FUNÇÃO: n8n-meta-sync
- Integração com n8n para automações

================================================================================
6. HOOKS CUSTOMIZADOS
================================================================================

6.1 AUTENTICAÇÃO E AUTORIZAÇÃO
------------------------------
useAuth - Gerenciamento de autenticação
useAdminAuth - Autenticação de admin
useUserRole - Roles do usuário
useProfile - Perfil do usuário

6.2 DADOS
---------
useProjects - CRUD de projetos
useDailyMetrics - Métricas diárias
useAdDailyMetrics - Métricas diárias de anúncios
useAdSetDailyMetrics - Métricas diárias de conjuntos
useMetaAdsData - Dados agregados Meta
useGoogleAdsData - Dados agregados Google
useDemographicInsights - Insights demográficos
useRealLeads - Leads reais
useCatalogImages - Imagens de catálogo

6.3 METAS E OBJETIVOS
---------------------
useAccountGoals - Metas de conta
useCampaignGoals - Metas de campanha

6.4 ANÁLISE
-----------
usePredictiveAnalysis - Análise preditiva
useAIAssistant - Assistente IA

6.5 CONFIGURAÇÃO
----------------
useProjectMetricConfig - Configuração de métricas
useChartPreferences - Preferências de gráficos

6.6 SYNC
--------
useSyncWithProgress - Sync com progresso
useImportProgress - Progresso de importação
useMonthImportStatus - Status por mês
useProjectHealth - Saúde do projeto

6.7 WHATSAPP
------------
useWhatsAppInstances - Instâncias por projeto
useWhatsAppManager - Instâncias do gestor
useWhatsAppSubscription - Assinaturas
useBalanceAlert - Alertas de saldo

6.8 UI/UX
---------
usePeriodContext - Contexto de período selecionado
useTheme - Tema (light/dark)
useTour - Tour guiado
useMobile - Detecção mobile
usePWA - Funcionalidades PWA
useChartResponsive - Responsividade de gráficos

6.9 OTIMIZAÇÃO
--------------
useOptimizationHistory - Histórico de otimizações
useSuggestionActions - Ações em sugestões
useAnomalyAlertConfig - Configuração de alertas

================================================================================
7. PÁGINAS DA APLICAÇÃO
================================================================================

7.1 AUTENTICAÇÃO
----------------
/auth - Login/Registro
/change-password - Alteração de senha

7.2 SELEÇÃO DE PROJETO
----------------------
/projects - Lista de projetos (ProjectSelector)
/onboarding - Onboarding de novos usuários
/guest-onboarding - Onboarding de convidados

7.3 DASHBOARD
-------------
/project/:projectId - Dashboard principal
  - Cards de métricas com animação
  - Gráficos de evolução
  - Top campanhas
  - Comparação de períodos
  - Filtros de período e plataforma

7.4 CAMPANHAS
-------------
/project/:projectId/campaigns - Lista de campanhas Meta
/project/:projectId/google-campaigns - Lista de campanhas Google
/project/:projectId/adsets - Lista de conjuntos de anúncios
/project/:projectId/adset/:adSetId - Detalhes do conjunto
/project/:projectId/ads - Lista de anúncios
/project/:projectId/ad/:adId - Detalhes do anúncio
/project/:projectId/creatives - Lista de criativos
/project/:projectId/creative/:creativeId - Detalhes do criativo

7.5 ANÁLISE
-----------
/project/:projectId/predictive - Análise preditiva
/project/:projectId/suggestions - Sugestões de otimização
/project/:projectId/ai-assistant - Assistente IA

7.6 HISTÓRICO
-------------
/project/:projectId/optimization-history - Histórico de otimizações
/project/:projectId/sync-history - Histórico de sincronizações

7.7 CONFIGURAÇÕES
-----------------
/project/:projectId/settings - Configurações do projeto
  - Geral (nome, modelo de negócio)
  - Métricas (configuração de cards)
  - Integrações (WhatsApp)
  - Convidados
  - Alertas

/project/:projectId/setup - Setup inicial do projeto

7.8 WHATSAPP
------------
/project/:projectId/whatsapp - WhatsApp do projeto
/whatsapp-manager - Gerenciador global de WhatsApp

7.9 ADMINISTRAÇÃO
-----------------
/admin - Administração global
  - Monitoramento de saúde
  - Importação de dados
  - Logs de sincronização
  - Detecção de gaps

/project/:projectId/admin - Administração do projeto

================================================================================
8. FLUXO DE SINCRONIZAÇÃO
================================================================================

8.1 SINCRONIZAÇÃO DIÁRIA (AUTOMÁTICA)
-------------------------------------
1. Cron job executa às 02:00 AM (Brasília)
2. scheduled-sync busca todos os projetos ativos
3. Para cada projeto:
   a. Chama meta-ads-sync com últimos 90 dias
   b. Busca campanhas, adsets, ads da API Meta
   c. Busca métricas diárias (insights)
   d. Agrega métricas por entidade
   e. Detecta mudanças (status, targeting)
   f. Salva em ads_daily_metrics
   g. Atualiza tabelas campaigns, ad_sets, ads
   h. Registra em optimization_history
   i. Envia alertas se configurado
4. Após sync, executa detect-and-fix-gaps

8.2 SINCRONIZAÇÃO MANUAL (SOB DEMANDA)
--------------------------------------
1. Usuário clica em "Sincronizar" no dashboard
2. Chama meta-ads-sync com período selecionado
3. Mesmo fluxo da sincronização diária
4. Feedback em tempo real via toast

8.3 IMPORTAÇÃO HISTÓRICA
------------------------
1. Admin seleciona projeto e período
2. import-historical-data divide em batches de 30 dias
3. Para cada batch:
   a. Chama meta-ads-sync
   b. Aguarda rate limit
   c. Atualiza progresso
4. Salva status em project_import_months

8.4 EXTRAÇÃO DE DADOS DA META API
---------------------------------
Campos de campanhas:
- id, name, status, objective, daily_budget, lifetime_budget

Campos de adsets:
- id, name, status, campaign_id, daily_budget, lifetime_budget, targeting

Campos de ads:
- id, name, status, adset_id, campaign_id
- creative{id, image_hash, object_story_spec, asset_feed_spec, thumbnail_url}

Campos de insights (métricas):
- spend, impressions, clicks, reach, frequency
- actions (conversões por tipo)
- action_values (valores de conversão)
- cost_per_action_type

8.5 EXTRAÇÃO DE CONVERSÕES
--------------------------
Prioridade de fontes:
1. actions array (leads, purchases, messaging_conversation_started)
2. cost_per_action_type
3. conversions array (legado)

Tipos de ação rastreados:
- lead, onsite_conversion.lead_grouped
- purchase, omni_purchase
- messaging_conversation_started_7d
- contact_total, contact_website, contact_mobile_app

================================================================================
9. REGRAS DE NEGÓCIO
================================================================================

9.1 CÁLCULOS DE MÉTRICAS
------------------------
CTR = (clicks / impressions) * 100
CPM = (spend / impressions) * 1000
CPC = spend / clicks
CPA = spend / conversions
ROAS = conversion_value / spend
Frequência = impressions / reach

9.2 COMPARAÇÃO DE PERÍODOS
--------------------------
- Período atual: selecionado pelo usuário
- Período anterior: mesmo número de dias antes do atual
- Variação = ((atual - anterior) / anterior) * 100

9.3 CORES DE INDICADORES
-------------------------
Positivo (verde): crescimento em métricas boas (conversões, CTR, ROAS)
                  ou redução em métricas ruins (CPA, CPC)
Negativo (vermelho): inverso do acima
Neutro (amarelo): variação pequena ou métrica sem direção clara

9.4 STATUS DE ENTIDADES
-----------------------
ACTIVE: Ativo e rodando
PAUSED: Pausado manualmente
ARCHIVED: Arquivado
DELETED: Excluído
PENDING_REVIEW: Em revisão
DISAPPROVED: Reprovado

9.5 MODELOS DE NEGÓCIO
----------------------
inside_sales: Foco em leads
ecommerce: Foco em vendas/ROAS
pdv: Ponto de venda físico
infoproduto: Produtos digitais
custom: Configuração personalizada

================================================================================
10. SEGURANÇA
================================================================================

10.1 AUTENTICAÇÃO
-----------------
- Supabase Auth com email/senha
- Tokens JWT com expiração
- Refresh token automático

10.2 AUTORIZAÇÃO (RLS)
----------------------
- Row Level Security habilitado em todas as tabelas
- Usuários só acessam seus próprios projetos
- Convidados acessam via guest_project_access
- Admins têm acesso global via user_roles

10.3 TOKENS DE API
------------------
- META_ACCESS_TOKEN: Token do Meta Ads
- GOOGLE_ADS_* : Credenciais Google Ads
- EVOLUTION_API_KEY: API do WhatsApp
- Todos armazenados como secrets do Supabase

10.4 VALIDAÇÕES
---------------
- Todas as entradas são validadas no backend
- SQL injection prevenido via Supabase client
- Rate limiting na API Meta

================================================================================
11. PERFORMANCE
================================================================================

11.1 CACHE
----------
- React Query com staleTime configurado
- ai_analysis_cache para respostas IA
- creative-images bucket para thumbnails

11.2 OTIMIZAÇÕES FRONTEND
-------------------------
- React.memo para componentes pesados
- useMemo/useCallback para evitar re-renders
- Lazy loading de rotas
- Skeletons durante loading

11.3 OTIMIZAÇÕES BACKEND
------------------------
- Índices em colunas frequentemente consultadas
- Upsert em batch (500 registros por vez)
- Paginação de resultados

================================================================================
12. MONITORAMENTO E LOGS
================================================================================

12.1 SYNC LOGS
--------------
- Registra cada sincronização
- Status: success, error, partial
- Mensagem com detalhes (JSON)

12.2 HEALTH SCORE
-----------------
- Calculado baseado em:
  - Último sync < 24h
  - Dados recentes disponíveis
  - Sem erros críticos

12.3 ALERTAS
------------
- Anomaly alerts para:
  - Queda de CTR > threshold
  - Aumento de CPL > threshold
  - Campanhas pausadas
  - Saldo baixo

================================================================================
13. INTEGRAÇÕES EXTERNAS
================================================================================

13.1 META ADS API
-----------------
- Graph API v22.0
- Endpoints: /campaigns, /adsets, /ads, /insights
- Rate limit: 200 calls / hour (por ad account)

13.2 GOOGLE ADS API
-------------------
- Google Ads API v17
- Autenticação OAuth 2.0
- Refresh token automático

13.3 EVOLUTION API (WHATSAPP)
-----------------------------
- API de WhatsApp Business
- Gerenciamento de instâncias
- Envio de mensagens

13.4 GEMINI AI
--------------
- Análise preditiva
- Assistente de tráfego
- Geração de sugestões

================================================================================
14. CONFIGURAÇÃO DE MÉTRICAS
================================================================================

14.1 MÉTRICAS PRIMÁRIAS (Cards grandes)
---------------------------------------
Configurável por projeto via project_metric_config.primary_metrics:
- spend, impressions, clicks, reach, conversions, leads, purchases

14.2 MÉTRICAS DE RESULTADO
--------------------------
result_metrics: Métricas de conversão (leads, purchases, conversions)
result_metric: Métrica principal para cálculo de CPL

14.3 MÉTRICAS DE CUSTO
----------------------
cost_metrics: CPM, CPC, CPA, CPL

14.4 MÉTRICAS DE EFICIÊNCIA
---------------------------
efficiency_metrics: CTR, ROAS, Frequency

================================================================================
15. RESPONSIVIDADE E UI
================================================================================

15.1 BREAKPOINTS
----------------
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

15.2 REGRAS CSS
---------------
- Grid responsiva com auto-fit / minmax
- Nenhuma largura fixa em px para containers
- overflow controlado em todos os cards
- Números grandes com truncamento

15.3 TEMAS
----------
- Light mode e Dark mode
- Variáveis CSS em index.css
- Cores semânticas (--primary, --background, etc.)

================================================================================
16. PWA (Progressive Web App)
================================================================================

- Manifest.json configurado
- Service Worker para cache offline
- Ícones para todas as plataformas
- Splash screens para iOS
- Prompt de instalação

================================================================================
17. CRONOGRAMA DE JOBS
================================================================================

17.1 DIÁRIO
-----------
Cron: 0 5 * * * (02:00 AM Brasília)
- Sincronização de todos os projetos
- Detecção e correção de gaps
- Envio de alertas de saldo

17.2 SEMANAL
------------
Cron: 0 3 * * 0 (Domingo 00:00 AM Brasília)
- Verificação profunda de gaps
- Relatórios semanais WhatsApp

================================================================================
18. TROUBLESHOOTING
================================================================================

18.1 SYNC NÃO FUNCIONA
----------------------
- Verificar META_ACCESS_TOKEN não expirado
- Verificar permissões da conta de anúncios
- Checar rate limits

18.2 MÉTRICAS ZERADAS
---------------------
- Verificar se há dados em ads_daily_metrics para o período
- Verificar filtros de status (ACTIVE vs todos)

18.3 IMAGENS NÃO CARREGAM
-------------------------
- URLs do Meta expiram após tempo
- Usar cached_image_url do bucket creative-images

================================================================================
19. GLOSSÁRIO
================================================================================

CTR: Click-Through Rate (Taxa de Cliques)
CPC: Cost Per Click (Custo por Clique)
CPM: Cost Per Mille (Custo por Mil Impressões)
CPA: Cost Per Action (Custo por Ação)
CPL: Cost Per Lead (Custo por Lead)
ROAS: Return On Ad Spend (Retorno sobre Gasto)
RLS: Row Level Security
Edge Function: Função serverless do Supabase
Upsert: Insert or Update

================================================================================
FIM DA DOCUMENTAÇÃO
================================================================================
Versão: 1.0
Data de Geração: ${new Date().toLocaleString('pt-BR')}
================================================================================
`;

  return documentation;
};

export const downloadDocumentationAsTxt = () => {
  const content = generateSystemDocumentation();
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `documentacao-sistema-v4-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadDocumentationAsPdf = () => {
  const content = generateSystemDocumentation();
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Configuração
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const lineHeight = 5;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // Fonte mono para melhor legibilidade
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8);

  const lines = content.split('\n');

  for (const line of lines) {
    // Verificar se precisa de nova página
    if (y > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }

    // Detectar linhas de cabeçalho (com =)
    if (line.includes('================')) {
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(9);
    } else if (line.match(/^\d+\.\d*\s+[A-Z]/)) {
      // Subtítulos numerados
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(8);
    } else {
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(7);
    }

    // Quebrar linhas longas
    const splitLines = pdf.splitTextToSize(line || ' ', contentWidth);
    
    for (const splitLine of splitLines) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(splitLine, margin, y);
      y += lineHeight;
    }
  }

  // Salvar
  pdf.save(`documentacao-sistema-v4-${new Date().toISOString().split('T')[0]}.pdf`);
};
