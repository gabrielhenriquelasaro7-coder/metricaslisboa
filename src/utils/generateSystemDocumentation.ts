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
14. INTEGRAÇÃO COM CRM (KOMMO E OUTROS)
================================================================================

14.1 VISÃO GERAL
----------------
O sistema possui integração com CRMs para criar um funil de vendas completo,
conectando dados de tráfego pago com conversões reais do CRM.

PROVEDORES SUPORTADOS:
- Kommo (antigo amoCRM) - Principal, totalmente implementado
- HubSpot - OAuth implementado
- RD Station - OAuth implementado
- GoHighLevel - OAuth implementado
- Bitrix24 - API Key
- Outros (genérico) - API Key

14.2 TABELAS DO CRM
-------------------
TABELA: crm_connections
- Armazena conexões de CRM por projeto
- Campos principais:
  - id, project_id, user_id
  - provider: kommo, hubspot, rdstation, gohighlevel, bitrix24, outros
  - status: pending, connected, disconnected, error
  - access_token, refresh_token (para OAuth)
  - api_key, api_url (para API Key)
  - mql_stage_ids: Array de IDs de etapas MQL
  - sql_stage_ids: Array de IDs de etapas SQL
  - config: JSONB com selected_pipeline_id

TABELA: crm_deals
- Leads/Oportunidades sincronizados do CRM
- Campos principais:
  - id, external_id (ID no CRM)
  - connection_id, project_id
  - title, contact_name, contact_email, contact_phone
  - value: Valor do negócio (em reais, não centavos)
  - status: open, won, lost
  - stage_name, external_stage_id, external_pipeline_id
  - UTMs: utm_source, utm_medium, utm_campaign, utm_content, utm_term
  - created_date, closed_date
  - owner_name, lead_source
  - custom_fields: JSONB com campos personalizados

TABELA: crm_pipelines
- Funis/Pipelines sincronizados do CRM
- external_id, external_name, stages (JSONB)

TABELA: crm_sync_logs
- Logs de sincronização
- sync_type: full, incremental
- records_processed, records_created, records_updated, records_failed

14.3 EDGE FUNCTIONS DO CRM
--------------------------
FUNÇÃO: crm-connect
- Inicia conexão com CRM
- API Key: valida e salva diretamente
- OAuth: retorna oauth_url para redirecionamento

FUNÇÃO: crm-callback
- Callback do OAuth
- Troca code por access_token
- Dispara sync inicial

FUNÇÃO: crm-sync
- Sincronização de dados do CRM
- POST: { connection_id, project_id, sync_type: 'full' | 'incremental' }
- Busca pipelines, etapas e leads
- Extrai UTMs dos campos personalizados
- IMPORTANTE: Valores do Kommo já vêm em reais (não divide por 100)

FUNÇÃO: crm-status
- Retorna status completo da conexão
- Pipelines, etapas com contagem de leads
- Deals com UTMs e campos customizados
- Funil calculado (leads → MQL → SQL → vendas)
- Stats: total_deals, won_deals, lost_deals, revenue

14.4 MAPEAMENTO MQL/SQL
-----------------------
O sistema suporta dois modos de cálculo do funil:

MODO AUTOMÁTICO (padrão):
- Divide etapas abertas (type=0) em 3 partes iguais
- Primeiro 1/3: Leads
- Segundo 1/3: MQL (Marketing Qualified Lead)
- Terceiro 1/3: SQL (Sales Qualified Lead)

MODO CUSTOMIZADO:
- Configurado via campos mql_stage_ids e sql_stage_ids na crm_connections
- Interface em Financial.tsx → StagesMappingConfig
- Permite selecionar quais etapas são MQL e SQL manualmente
- Etapas não mapeadas são contadas como Leads

CÁLCULO DO FUNIL:
- Leads: Total de deals no CRM
- MQL: Deals em etapas MQL + SQL + Vendas ganhas
- SQL: Deals em etapas SQL + Vendas ganhas
- Vendas: Deals com status 'won'
- Receita: Soma dos valores de deals ganhos

14.5 FLUXO DE DADOS KOMMO
-------------------------
1. Usuário conecta via API Key (subdomínio + token)
2. crm-connect valida credenciais testando /api/v4/account
3. crm-sync busca:
   - GET /api/v4/leads/pipelines (funis e etapas)
   - GET /api/v4/leads?with=contacts (leads com contatos)
   - Para cada lead, busca campos customizados para UTMs
4. Salva em crm_deals com:
   - value = lead.price (já em reais, NÃO dividir por 100)
   - UTMs extraídos dos custom_fields
5. crm-status calcula funil e retorna para frontend

14.6 EXTRAÇÃO DE UTMs
---------------------
UTMs são extraídos de campos personalizados do Kommo:
- Busca campos com nomes contendo: utm_source, utm_medium, etc.
- Também busca: source, medium, campaign, content, term
- Salva em colunas dedicadas para análise

================================================================================
15. QUERIES SQL DE MÉTRICAS
================================================================================

15.1 MÉTRICAS DIÁRIAS (Dashboard Principal)
-------------------------------------------
HOOK: useDailyMetrics.tsx

Query para período atual:
SELECT 
  date, 
  spend, 
  impressions, 
  clicks, 
  reach, 
  conversions, 
  conversion_value, 
  messaging_replies, 
  profile_visits, 
  campaign_objective, 
  leads_count, 
  purchases_count
FROM ads_daily_metrics
WHERE project_id = :projectId
  AND date >= :since
  AND date <= :until
ORDER BY date ASC

Agregação diária:
- Soma todos os campos numéricos por data
- leads_conversions = soma de leads_count
- sales_conversions = soma de purchases_count
- conversions = soma de conversions (total)

Cálculo de métricas derivadas:
- CTR = (clicks / impressions) * 100
- CPM = (spend / impressions) * 1000
- CPC = spend / clicks
- CPA = spend / conversions
- ROAS = conversion_value / spend

15.2 COMPARAÇÃO DE PERÍODOS
---------------------------
Período anterior calculado por tipo:
- same_length: Mesmo número de dias antes do período atual
- previous_month: Mês anterior (para "Este Mês")
- two_months_ago: 2 meses atrás (para "Mês Passado")
- previous_year: Mesmo período ano anterior (para "Este Ano")

Variação percentual:
change = ((atual - anterior) / anterior) * 100

15.3 MÉTRICAS DE CAMPANHA
-------------------------
HOOK: useMetaAdsData.tsx

Query de campanhas:
SELECT *
FROM campaigns
WHERE project_id = :projectId
ORDER BY spend DESC

Query de Ad Sets:
SELECT *
FROM ad_sets
WHERE project_id = :projectId
  AND campaign_id = :campaignId
ORDER BY spend DESC

Query de Ads:
SELECT *
FROM ads
WHERE project_id = :projectId
ORDER BY spend DESC

15.4 MÉTRICAS DE CRM
--------------------
HOOK: useCRMConnection.tsx
EDGE FUNCTION: crm-status

Query de deals:
SELECT 
  id, external_id, title, 
  contact_name, contact_phone, contact_email, 
  value, status, stage_name, 
  external_stage_id, external_pipeline_id, 
  created_date, closed_date, 
  utm_source, utm_medium, utm_campaign, utm_content, utm_term, 
  lead_source, owner_name, custom_fields
FROM crm_deals
WHERE connection_id = :connectionId
ORDER BY created_date DESC
LIMIT 500

Stats por status:
SELECT status, value
FROM crm_deals
WHERE connection_id = :connectionId

Contagem por pipeline:
SELECT external_pipeline_id, COUNT(*) as count
FROM crm_deals
WHERE connection_id = :connectionId
GROUP BY external_pipeline_id

15.5 MÉTRICAS DO GOOGLE ADS
---------------------------
HOOK: useGoogleAdsData.tsx

Query principal:
SELECT *
FROM google_ads_daily_metrics
WHERE project_id = :projectId
  AND date >= :since
  AND date <= :until
ORDER BY date ASC

15.6 INSIGHTS DEMOGRÁFICOS
--------------------------
HOOK: useDemographicInsights.tsx

Query:
SELECT 
  breakdown_type, 
  breakdown_value, 
  SUM(spend) as spend, 
  SUM(impressions) as impressions, 
  SUM(clicks) as clicks, 
  SUM(conversions) as conversions
FROM demographic_insights
WHERE project_id = :projectId
  AND date >= :since
  AND date <= :until
GROUP BY breakdown_type, breakdown_value

15.7 SALDO DA CONTA (ACCOUNT BALANCE)
--------------------------------------
HOOK: useBalanceAlert.tsx
COMPONENTE: AccountBalanceCard.tsx
EDGE FUNCTION: predictive-analysis

Endpoint Meta Graph API:
GET https://graph.facebook.com/v22.0/act_{ad_account_id}
  ?fields=balance,amount_spent,currency,funding_source_details,account_status,spend_cap
  &access_token={META_ACCESS_TOKEN}

Tipos de Funding (funding_source_details.type):
- 1: Cartão de Crédito (pós-pago) - balance em centavos
- 2: Cupom Facebook
- 3: Débito Direto / PIX (pré-pago) - saldo no display_string
- 4: PayPal
- 5: Transferência Bancária (pré-pago)
- 20: Linha de Crédito / Ad Credits (pré-pago)

Status da Conta (account_status):
- 1: ACTIVE - Conta ativa
- 2: DISABLED - Conta desativada
- 3: UNSETTLED - Problemas de pagamento / sem saldo
- 7: PENDING_REVIEW - Em revisão
- 9: IN_GRACE_PERIOD - Período de graça

Extração do Saldo:
- Cartão (type=1): balance / 100 (converter centavos para reais)
- Pré-pago (type=3,5,20): Regex no display_string "R$ X.XXX,XX"
- Conta bloqueada (status=2,3): Saldo efetivo = 0

Query para buscar saldo salvo:
SELECT account_balance, account_balance_updated_at 
FROM projects 
WHERE id = '{projectId}'

Query para atualizar saldo:
UPDATE projects 
SET account_balance = {valor}, account_balance_updated_at = now() 
WHERE id = '{projectId}'

Query para calcular gasto médio (últimos 7 dias):
SELECT spend, date 
FROM ads_daily_metrics 
WHERE project_id = '{projectId}' 
  AND date >= '{hoje - 7 dias}' 
  AND date <= '{hoje}'

Cálculo de dias restantes:
avgDailySpend = SUM(spend) / COUNT(DISTINCT date)
daysRemaining = FLOOR(account_balance / avgDailySpend)

Status do saldo:
- healthy: daysRemaining > 7
- warning: daysRemaining <= 7
- critical: daysRemaining <= 3

Query de config de alertas:
SELECT balance_alert_enabled, balance_alert_threshold 
FROM whatsapp_subscriptions 
WHERE project_id = '{projectId}' AND user_id = '{userId}'

================================================================================
16. CONFIGURAÇÃO DE MÉTRICAS
================================================================================

16.1 MÉTRICAS PRIMÁRIAS (Cards grandes)
---------------------------------------
Configurável por projeto via project_metric_config.primary_metrics:
- spend, impressions, clicks, reach, conversions, leads, purchases

16.2 MÉTRICAS DE RESULTADO
--------------------------
result_metrics: Métricas de conversão (leads, purchases, conversions)
result_metric: Métrica principal para cálculo de CPL

16.3 MÉTRICAS DE CUSTO
----------------------
cost_metrics: CPM, CPC, CPA, CPL

16.4 MÉTRICAS DE EFICIÊNCIA
---------------------------
efficiency_metrics: CTR, ROAS, Frequency

================================================================================
17. RESPONSIVIDADE E UI
================================================================================

17.1 BREAKPOINTS
----------------
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

17.2 REGRAS CSS
---------------
- Grid responsiva com auto-fit / minmax
- Nenhuma largura fixa em px para containers
- overflow controlado em todos os cards
- Números grandes com truncamento

17.3 TEMAS
----------
- Light mode e Dark mode
- Variáveis CSS em index.css
- Cores semânticas (--primary, --background, etc.)

================================================================================
18. PWA (Progressive Web App)
================================================================================

- Manifest.json configurado
- Service Worker para cache offline
- Ícones para todas as plataformas
- Splash screens para iOS
- Prompt de instalação

================================================================================
19. CRONOGRAMA DE JOBS
================================================================================

19.1 DIÁRIO
-----------
Cron: 0 5 * * * (02:00 AM Brasília)
- Sincronização de todos os projetos
- Detecção e correção de gaps
- Envio de alertas de saldo

19.2 SEMANAL
------------
Cron: 0 3 * * 0 (Domingo 00:00 AM Brasília)
- Verificação profunda de gaps
- Relatórios semanais WhatsApp

================================================================================
20. TROUBLESHOOTING
================================================================================

20.1 SYNC NÃO FUNCIONA
----------------------
- Verificar META_ACCESS_TOKEN não expirado
- Verificar permissões da conta de anúncios
- Checar rate limits

20.2 MÉTRICAS ZERADAS
---------------------
- Verificar se há dados em ads_daily_metrics para o período
- Verificar filtros de status (ACTIVE vs todos)

20.3 IMAGENS NÃO CARREGAM
-------------------------
- URLs do Meta expiram após tempo
- Usar cached_image_url do bucket creative-images

20.4 CRM NÃO SINCRONIZA
-----------------------
- Verificar token de acesso válido
- Checar URL da API (com https://)
- Verificar permissões no Kommo

20.5 VALORES DO CRM ERRADOS
---------------------------
- Kommo retorna valores em REAIS (não centavos)
- NÃO dividir lead.price por 100
- Verificar se sync foi executado após correção

================================================================================
21. GLOSSÁRIO
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
MQL: Marketing Qualified Lead (Lead Qualificado pelo Marketing)
SQL: Sales Qualified Lead (Lead Qualificado para Vendas)
CRM: Customer Relationship Management
UTM: Urchin Tracking Module (parâmetros de rastreamento)

================================================================================
FIM DA DOCUMENTAÇÃO
================================================================================
Versão: 2.1
Atualização: Adicionada documentação de Saldo da Conta (Balance)
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

// Database schema as JSON for export
export const generateDatabaseSchemaJSON = () => {
  const schema = {
    version: "2.1",
    generatedAt: new Date().toISOString(),
    tables: {
      projects: {
        description: "Projetos/Clientes",
        columns: {
          id: { type: "UUID", primaryKey: true },
          user_id: { type: "UUID", nullable: false },
          name: { type: "TEXT", nullable: false },
          ad_account_id: { type: "TEXT", nullable: false },
          google_customer_id: { type: "TEXT", nullable: true },
          facebook_page_id: { type: "TEXT", nullable: true },
          business_model: { type: "ENUM", values: ["inside_sales", "ecommerce", "pdv", "infoproduto", "custom"] },
          currency: { type: "TEXT", default: "BRL" },
          timezone: { type: "TEXT", default: "America/Sao_Paulo" },
          account_balance: { type: "NUMERIC", nullable: true },
          account_balance_updated_at: { type: "TIMESTAMPTZ", nullable: true },
          health_score: { type: "TEXT", nullable: true },
          last_sync_at: { type: "TIMESTAMPTZ", nullable: true },
          sync_progress: { type: "JSONB", nullable: true },
          archived: { type: "BOOLEAN", default: false },
          avatar_url: { type: "TEXT", nullable: true },
          ai_briefing: { type: "TEXT", nullable: true },
          squad_id: { type: "UUID", nullable: true },
          investidor_id: { type: "UUID", nullable: true },
          created_at: { type: "TIMESTAMPTZ", default: "now()" },
          updated_at: { type: "TIMESTAMPTZ", default: "now()" }
        }
      },
      ads_daily_metrics: {
        description: "Métricas diárias de anúncios (principal)",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          date: { type: "DATE", nullable: false },
          ad_account_id: { type: "TEXT", nullable: false },
          ad_id: { type: "TEXT", nullable: false },
          ad_name: { type: "TEXT", nullable: false },
          ad_status: { type: "TEXT", nullable: true },
          adset_id: { type: "TEXT", nullable: false },
          adset_name: { type: "TEXT", nullable: false },
          adset_status: { type: "TEXT", nullable: true },
          campaign_id: { type: "TEXT", nullable: false },
          campaign_name: { type: "TEXT", nullable: false },
          campaign_status: { type: "TEXT", nullable: true },
          campaign_objective: { type: "TEXT", nullable: true },
          spend: { type: "NUMERIC", default: 0 },
          impressions: { type: "INTEGER", default: 0 },
          clicks: { type: "INTEGER", default: 0 },
          reach: { type: "INTEGER", default: 0 },
          frequency: { type: "NUMERIC", nullable: true },
          ctr: { type: "NUMERIC", nullable: true },
          cpm: { type: "NUMERIC", nullable: true },
          cpc: { type: "NUMERIC", nullable: true },
          cpa: { type: "NUMERIC", nullable: true },
          conversions: { type: "INTEGER", nullable: true },
          conversion_value: { type: "NUMERIC", nullable: true },
          roas: { type: "NUMERIC", nullable: true },
          leads_count: { type: "INTEGER", nullable: true },
          purchases_count: { type: "INTEGER", nullable: true },
          messaging_replies: { type: "INTEGER", nullable: true },
          profile_visits: { type: "INTEGER", nullable: true },
          initiate_checkout_count: { type: "INTEGER", nullable: true },
          creative_id: { type: "TEXT", nullable: true },
          creative_thumbnail: { type: "TEXT", nullable: true },
          cached_creative_thumbnail: { type: "TEXT", nullable: true },
          synced_at: { type: "TIMESTAMPTZ", default: "now()" },
          created_at: { type: "TIMESTAMPTZ", default: "now()" }
        },
        indexes: ["project_id", "date", "ad_id", "campaign_id"]
      },
      campaigns: {
        description: "Campanhas Meta Ads (agregado)",
        columns: {
          id: { type: "TEXT", primaryKey: true, description: "Meta Campaign ID" },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          name: { type: "TEXT", nullable: false },
          status: { type: "TEXT", values: ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"] },
          objective: { type: "TEXT", nullable: true },
          daily_budget: { type: "NUMERIC", nullable: true },
          lifetime_budget: { type: "NUMERIC", nullable: true },
          spend: { type: "NUMERIC", nullable: true },
          impressions: { type: "INTEGER", nullable: true },
          clicks: { type: "INTEGER", nullable: true },
          reach: { type: "INTEGER", nullable: true },
          conversions: { type: "INTEGER", nullable: true },
          conversion_value: { type: "NUMERIC", nullable: true },
          ctr: { type: "NUMERIC", nullable: true },
          cpc: { type: "NUMERIC", nullable: true },
          cpm: { type: "NUMERIC", nullable: true },
          cpa: { type: "NUMERIC", nullable: true },
          roas: { type: "NUMERIC", nullable: true },
          messaging_replies: { type: "INTEGER", nullable: true },
          profile_visits: { type: "INTEGER", nullable: true },
          synced_at: { type: "TIMESTAMPTZ", nullable: true },
          created_at: { type: "TIMESTAMPTZ", default: "now()" }
        }
      },
      ad_sets: {
        description: "Conjuntos de anúncios Meta Ads (agregado)",
        columns: {
          id: { type: "TEXT", primaryKey: true, description: "Meta AdSet ID" },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          campaign_id: { type: "TEXT", nullable: false },
          name: { type: "TEXT", nullable: false },
          status: { type: "TEXT", nullable: true },
          targeting: { type: "JSONB", nullable: true },
          daily_budget: { type: "NUMERIC", nullable: true },
          lifetime_budget: { type: "NUMERIC", nullable: true },
          spend: { type: "NUMERIC", nullable: true },
          impressions: { type: "INTEGER", nullable: true },
          clicks: { type: "INTEGER", nullable: true },
          reach: { type: "INTEGER", nullable: true },
          conversions: { type: "INTEGER", nullable: true },
          conversion_value: { type: "NUMERIC", nullable: true },
          synced_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      ads: {
        description: "Anúncios Meta Ads (agregado)",
        columns: {
          id: { type: "TEXT", primaryKey: true, description: "Meta Ad ID" },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          campaign_id: { type: "TEXT", nullable: false },
          ad_set_id: { type: "TEXT", nullable: false },
          name: { type: "TEXT", nullable: false },
          status: { type: "TEXT", nullable: true },
          creative_id: { type: "TEXT", nullable: true },
          creative_image_url: { type: "TEXT", nullable: true },
          creative_video_url: { type: "TEXT", nullable: true },
          creative_thumbnail: { type: "TEXT", nullable: true },
          cached_image_url: { type: "TEXT", nullable: true, description: "URL do Supabase Storage" },
          headline: { type: "TEXT", nullable: true },
          primary_text: { type: "TEXT", nullable: true },
          cta: { type: "TEXT", nullable: true },
          spend: { type: "NUMERIC", nullable: true },
          impressions: { type: "INTEGER", nullable: true },
          clicks: { type: "INTEGER", nullable: true },
          conversions: { type: "INTEGER", nullable: true },
          synced_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      crm_connections: {
        description: "Conexões com CRMs",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          user_id: { type: "UUID", nullable: false },
          provider: { type: "ENUM", values: ["kommo", "hubspot", "rdstation", "gohighlevel", "bitrix24", "outros"] },
          status: { type: "ENUM", values: ["pending", "connected", "disconnected", "error"] },
          access_token: { type: "TEXT", nullable: true },
          refresh_token: { type: "TEXT", nullable: true },
          api_key: { type: "TEXT", nullable: true },
          api_url: { type: "TEXT", nullable: true },
          mql_stage_ids: { type: "TEXT[]", nullable: true },
          sql_stage_ids: { type: "TEXT[]", nullable: true },
          config: { type: "JSONB", nullable: true, description: "selected_pipeline_id, etc" },
          funnel_cards_config: { type: "JSONB", nullable: true },
          display_name: { type: "TEXT", nullable: true },
          connected_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      crm_deals: {
        description: "Leads/Oportunidades do CRM",
        columns: {
          id: { type: "UUID", primaryKey: true },
          external_id: { type: "TEXT", nullable: false, description: "ID no CRM externo" },
          connection_id: { type: "UUID", foreignKey: "crm_connections.id" },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          title: { type: "TEXT", nullable: false },
          contact_name: { type: "TEXT", nullable: true },
          contact_email: { type: "TEXT", nullable: true },
          contact_phone: { type: "TEXT", nullable: true },
          value: { type: "NUMERIC", nullable: true, description: "Valor em reais (não centavos)" },
          status: { type: "ENUM", values: ["open", "won", "lost"] },
          stage_name: { type: "TEXT", nullable: true },
          external_stage_id: { type: "TEXT", nullable: true },
          external_pipeline_id: { type: "TEXT", nullable: true },
          pipeline_id: { type: "UUID", foreignKey: "crm_pipelines.id", nullable: true },
          utm_source: { type: "TEXT", nullable: true },
          utm_medium: { type: "TEXT", nullable: true },
          utm_campaign: { type: "TEXT", nullable: true },
          utm_content: { type: "TEXT", nullable: true },
          utm_term: { type: "TEXT", nullable: true },
          lead_source: { type: "TEXT", nullable: true },
          owner_name: { type: "TEXT", nullable: true },
          created_date: { type: "TIMESTAMPTZ", nullable: true },
          closed_date: { type: "TIMESTAMPTZ", nullable: true },
          custom_fields: { type: "JSONB", nullable: true },
          synced_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      crm_pipelines: {
        description: "Funis/Pipelines do CRM",
        columns: {
          id: { type: "UUID", primaryKey: true },
          external_id: { type: "TEXT", nullable: false },
          external_name: { type: "TEXT", nullable: false },
          connection_id: { type: "UUID", foreignKey: "crm_connections.id" },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          stages: { type: "JSONB", nullable: true, description: "Array de etapas com id, name, type" },
          is_default: { type: "BOOLEAN", default: false },
          synced_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      account_goals: {
        description: "Metas globais por projeto",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id", unique: true },
          target_spend_daily: { type: "NUMERIC", nullable: true },
          target_spend_monthly: { type: "NUMERIC", nullable: true },
          target_cpc: { type: "NUMERIC", nullable: true },
          target_cpl: { type: "NUMERIC", nullable: true },
          target_ctr: { type: "NUMERIC", nullable: true },
          target_roas: { type: "NUMERIC", nullable: true },
          target_leads_monthly: { type: "INTEGER", nullable: true }
        }
      },
      campaign_goals: {
        description: "Metas por campanha",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          campaign_id: { type: "TEXT", nullable: false },
          campaign_name: { type: "TEXT", nullable: false },
          target_cpl: { type: "NUMERIC", nullable: true },
          target_ctr: { type: "NUMERIC", nullable: true },
          target_leads: { type: "INTEGER", nullable: true },
          target_roas: { type: "NUMERIC", nullable: true },
          max_cpc: { type: "NUMERIC", nullable: true }
        }
      },
      whatsapp_instances: {
        description: "Instâncias WhatsApp por projeto",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          user_id: { type: "UUID", nullable: false },
          instance_name: { type: "TEXT", nullable: false },
          status: { type: "TEXT", values: ["connected", "disconnected", "connecting"] },
          phone_number: { type: "TEXT", nullable: true },
          qr_code: { type: "TEXT", nullable: true }
        }
      },
      whatsapp_subscriptions: {
        description: "Assinaturas de relatórios WhatsApp",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          user_id: { type: "UUID", nullable: false },
          instance_id: { type: "UUID", foreignKey: "whatsapp_instances.id", nullable: true },
          phone_number: { type: "TEXT", nullable: true },
          group_id: { type: "TEXT", nullable: true },
          group_name: { type: "TEXT", nullable: true },
          enabled: { type: "BOOLEAN", default: true },
          report_schedule: { type: "TEXT", nullable: true },
          include_spend: { type: "BOOLEAN", default: true },
          include_leads: { type: "BOOLEAN", default: true },
          balance_alert_enabled: { type: "BOOLEAN", default: false },
          balance_alert_threshold: { type: "INTEGER", default: 3, description: "Dias de saldo para alertar" },
          last_balance_alert_at: { type: "TIMESTAMPTZ", nullable: true },
          last_report_sent_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      whatsapp_report_configs: {
        description: "Configurações de relatórios WhatsApp",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          instance_id: { type: "UUID", foreignKey: "whatsapp_instances.id", nullable: true },
          group_id: { type: "TEXT", nullable: true },
          group_name: { type: "TEXT", nullable: true },
          enabled: { type: "BOOLEAN", default: true },
          balance_alert_enabled: { type: "BOOLEAN", default: false },
          balance_alert_threshold: { type: "INTEGER", default: 3 },
          last_balance_alert_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      optimization_history: {
        description: "Histórico de mudanças em campanhas/adsets/ads",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          entity_type: { type: "TEXT", values: ["campaign", "adset", "ad"] },
          entity_id: { type: "TEXT", nullable: false },
          entity_name: { type: "TEXT", nullable: false },
          change_type: { type: "TEXT", values: ["created", "paused", "activated", "status_change", "targeting_change", "budget_change"] },
          field_changed: { type: "TEXT", nullable: false },
          old_value: { type: "TEXT", nullable: true },
          new_value: { type: "TEXT", nullable: true },
          change_percentage: { type: "NUMERIC", nullable: true },
          changed_by: { type: "TEXT", nullable: true },
          detected_at: { type: "TIMESTAMPTZ", default: "now()" }
        }
      },
      anomaly_alerts: {
        description: "Alertas de anomalias detectadas",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          entity_type: { type: "TEXT", values: ["campaign", "adset", "ad"] },
          entity_id: { type: "TEXT", nullable: false },
          entity_name: { type: "TEXT", nullable: false },
          anomaly_type: { type: "TEXT", values: ["ctr_drop", "cpl_increase", "campaign_paused", "budget_change", "balance_low"] },
          severity: { type: "TEXT", values: ["warning", "critical"], default: "warning" },
          details: { type: "JSONB", nullable: true },
          notified: { type: "BOOLEAN", default: false },
          notified_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      anomaly_alert_config: {
        description: "Configuração de alertas de anomalias",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          user_id: { type: "UUID", nullable: false },
          enabled: { type: "BOOLEAN", default: true },
          ctr_drop_threshold: { type: "NUMERIC", nullable: true, description: "% de queda para alertar" },
          cpl_increase_threshold: { type: "NUMERIC", nullable: true, description: "% de aumento para alertar" },
          campaign_paused_alert: { type: "BOOLEAN", default: true },
          ad_set_paused_alert: { type: "BOOLEAN", default: true },
          ad_paused_alert: { type: "BOOLEAN", default: false },
          budget_change_alert: { type: "BOOLEAN", default: true },
          instance_id: { type: "UUID", foreignKey: "whatsapp_instances.id", nullable: true },
          target_type: { type: "TEXT", values: ["phone", "group"], default: "phone" },
          phone_number: { type: "TEXT", nullable: true },
          group_id: { type: "TEXT", nullable: true }
        }
      },
      google_campaigns: {
        description: "Campanhas Google Ads",
        columns: {
          id: { type: "TEXT", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          name: { type: "TEXT", nullable: false },
          status: { type: "TEXT", nullable: true },
          campaign_type: { type: "TEXT", nullable: true },
          bidding_strategy: { type: "TEXT", nullable: true },
          budget_amount: { type: "NUMERIC", nullable: true },
          spend: { type: "NUMERIC", nullable: true },
          impressions: { type: "INTEGER", nullable: true },
          clicks: { type: "INTEGER", nullable: true },
          conversions: { type: "INTEGER", nullable: true },
          conversion_value: { type: "NUMERIC", nullable: true }
        }
      },
      google_ads_daily_metrics: {
        description: "Métricas diárias Google Ads",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          date: { type: "DATE", nullable: false },
          customer_id: { type: "TEXT", nullable: false },
          campaign_id: { type: "TEXT", nullable: false },
          campaign_name: { type: "TEXT", nullable: false },
          ad_group_id: { type: "TEXT", nullable: false },
          ad_group_name: { type: "TEXT", nullable: false },
          ad_id: { type: "TEXT", nullable: false },
          ad_name: { type: "TEXT", nullable: false },
          spend: { type: "NUMERIC", default: 0 },
          impressions: { type: "INTEGER", default: 0 },
          clicks: { type: "INTEGER", default: 0 },
          conversions: { type: "INTEGER", nullable: true },
          conversion_value: { type: "NUMERIC", nullable: true },
          search_impression_share: { type: "NUMERIC", nullable: true }
        }
      },
      profiles: {
        description: "Perfis de usuários",
        columns: {
          id: { type: "UUID", primaryKey: true },
          user_id: { type: "UUID", unique: true },
          full_name: { type: "TEXT", nullable: true },
          avatar_url: { type: "TEXT", nullable: true },
          cargo: { type: "TEXT", nullable: true }
        }
      },
      user_roles: {
        description: "Roles e cargos de usuários",
        columns: {
          id: { type: "UUID", primaryKey: true },
          user_id: { type: "UUID", unique: true },
          role: { type: "ENUM", values: ["admin", "gestor", "convidado"], default: "gestor" },
          cargo: { type: "ENUM", values: ["tech", "gerente", "coordenador", "investidor", "membro"], default: "membro" },
          is_master: { type: "BOOLEAN", default: false }
        }
      },
      squads: {
        description: "Squads/Times",
        columns: {
          id: { type: "UUID", primaryKey: true },
          name: { type: "TEXT", nullable: false },
          description: { type: "TEXT", nullable: true }
        }
      },
      squad_members: {
        description: "Membros de squads",
        columns: {
          id: { type: "UUID", primaryKey: true },
          squad_id: { type: "UUID", foreignKey: "squads.id" },
          user_id: { type: "UUID", nullable: false }
        }
      },
      leads: {
        description: "Leads capturados via Meta Lead Forms",
        columns: {
          id: { type: "TEXT", primaryKey: true, description: "Meta Lead ID" },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          form_id: { type: "TEXT", nullable: false },
          form_name: { type: "TEXT", nullable: true },
          lead_name: { type: "TEXT", nullable: true },
          lead_email: { type: "TEXT", nullable: true },
          lead_phone: { type: "TEXT", nullable: true },
          field_data: { type: "JSONB", nullable: true },
          campaign_id: { type: "TEXT", nullable: true },
          adset_id: { type: "TEXT", nullable: true },
          ad_id: { type: "TEXT", nullable: true },
          created_time: { type: "TIMESTAMPTZ", nullable: false }
        }
      },
      demographic_insights: {
        description: "Insights demográficos (idade, gênero, região)",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          date: { type: "DATE", nullable: false },
          breakdown_type: { type: "TEXT", values: ["age", "gender", "region"] },
          breakdown_value: { type: "TEXT", nullable: false },
          spend: { type: "NUMERIC", nullable: true },
          impressions: { type: "INTEGER", nullable: true },
          clicks: { type: "INTEGER", nullable: true },
          conversions: { type: "INTEGER", nullable: true },
          reach: { type: "INTEGER", nullable: true }
        }
      },
      dre_history: {
        description: "Histórico de DRE (Demonstração de Resultados)",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          user_id: { type: "UUID", nullable: false },
          year: { type: "INTEGER", nullable: false },
          month: { type: "INTEGER", nullable: false },
          period_start: { type: "DATE", nullable: false },
          period_end: { type: "DATE", nullable: false },
          gross_revenue: { type: "NUMERIC", nullable: true },
          net_revenue: { type: "NUMERIC", nullable: true },
          deductions: { type: "NUMERIC", nullable: true },
          total_ad_spend: { type: "NUMERIC", nullable: true },
          ad_spend_meta: { type: "NUMERIC", nullable: true },
          ad_spend_google: { type: "NUMERIC", nullable: true },
          operational_expenses: { type: "NUMERIC", nullable: true },
          ebitda: { type: "NUMERIC", nullable: true },
          roas: { type: "NUMERIC", nullable: true },
          cac: { type: "NUMERIC", nullable: true },
          cpl: { type: "NUMERIC", nullable: true },
          total_leads: { type: "INTEGER", nullable: true },
          total_sales: { type: "INTEGER", nullable: true },
          status: { type: "TEXT", values: ["draft", "closed"], default: "draft" }
        }
      },
      sync_logs: {
        description: "Logs de sincronização",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          sync_type: { type: "TEXT", values: ["meta", "google", "leads", "crm"] },
          status: { type: "TEXT", values: ["success", "error", "partial"] },
          message: { type: "JSONB", nullable: true },
          records_processed: { type: "INTEGER", nullable: true },
          started_at: { type: "TIMESTAMPTZ", nullable: true },
          completed_at: { type: "TIMESTAMPTZ", nullable: true }
        }
      },
      project_import_months: {
        description: "Status de importação por mês",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          year: { type: "INTEGER", nullable: false },
          month: { type: "INTEGER", nullable: false },
          status: { type: "TEXT", values: ["pending", "importing", "completed", "error"] },
          records_imported: { type: "INTEGER", nullable: true },
          error_message: { type: "TEXT", nullable: true }
        }
      },
      project_metric_config: {
        description: "Configuração de métricas por projeto",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id", unique: true },
          primary_metrics: { type: "TEXT[]", nullable: true },
          result_metrics: { type: "TEXT[]", nullable: true },
          cost_metrics: { type: "TEXT[]", nullable: true },
          efficiency_metrics: { type: "TEXT[]", nullable: true },
          result_metric: { type: "TEXT", nullable: true, description: "Métrica principal de resultado" }
        }
      },
      ai_analysis_cache: {
        description: "Cache de análises da IA",
        columns: {
          id: { type: "UUID", primaryKey: true },
          project_id: { type: "UUID", foreignKey: "projects.id" },
          query_hash: { type: "TEXT", nullable: false },
          user_message: { type: "TEXT", nullable: false },
          ai_response: { type: "TEXT", nullable: false },
          context_summary: { type: "JSONB", nullable: true },
          expires_at: { type: "TIMESTAMPTZ", nullable: false }
        }
      }
    },
    edgeFunctions: {
      "meta-ads-sync": {
        description: "Sincronização principal com Meta Ads API",
        method: "POST",
        params: ["project_id", "ad_account_id", "time_range", "date_preset", "light_sync", "skip_image_cache", "syncOnly", "syncMode"]
      },
      "import-month-by-month": {
        description: "Importação histórica mês a mês",
        method: "POST",
        params: ["project_id", "year", "month", "continue_chain", "max_month", "fetch_creatives_only", "lite_mode"]
      },
      "import-historical-data": {
        description: "Importação histórica por período",
        method: "POST",
        params: ["project_id", "since", "until", "safe_mode"]
      },
      "google-ads-sync": {
        description: "Sincronização com Google Ads API",
        method: "POST",
        params: ["project_id", "date_preset", "time_range"]
      },
      "meta-leads-sync": {
        description: "Sincronização de leads Meta",
        method: "POST",
        params: ["project_id", "facebook_page_id"]
      },
      "predictive-analysis": {
        description: "Análise preditiva com IA + saldo da conta",
        method: "POST",
        params: ["projectId", "accountGoal"],
        returns: ["accountBalance", "predictions", "suggestions", "totals", "dailyTrend"]
      },
      "ai-traffic-assistant": {
        description: "Assistente IA de tráfego",
        method: "POST",
        params: ["project_id", "message", "context"]
      },
      "crm-connect": {
        description: "Conectar com CRM",
        method: "POST",
        params: ["project_id", "provider", "api_key", "api_url"]
      },
      "crm-sync": {
        description: "Sincronizar dados do CRM",
        method: "POST",
        params: ["connection_id", "project_id", "sync_type"]
      },
      "crm-status": {
        description: "Status da conexão CRM",
        method: "POST",
        params: ["connection_id", "project_id", "pipeline_id"]
      },
      "whatsapp-send": {
        description: "Enviar mensagem WhatsApp",
        method: "POST",
        params: ["instance_id", "phone_number", "group_id", "message"]
      },
      "whatsapp-weekly-report": {
        description: "Relatórios semanais automáticos",
        method: "POST",
        params: []
      },
      "whatsapp-balance-alert": {
        description: "Alertas de saldo baixo",
        method: "POST",
        params: ["projectId", "forceResend"]
      },
      "detect-and-fix-gaps": {
        description: "Detectar e corrigir gaps de dados",
        method: "POST",
        params: ["auto_fix", "project_id"]
      },
      "scheduled-sync": {
        description: "Sincronização agendada (cron)",
        method: "POST",
        params: []
      },
      "sync-demographics": {
        description: "Sincronizar insights demográficos",
        method: "POST",
        params: ["project_id"]
      }
    },
    metaApiEndpoints: {
      campaigns: "GET /{ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget",
      adsets: "GET /{ad_account_id}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting",
      ads: "GET /{ad_account_id}/ads?fields=id,name,status,adset_id,campaign_id,creative{...}",
      insights: "GET /{ad_account_id}/insights?level=ad&fields=ad_id,spend,impressions,clicks,reach,actions...",
      accountBalance: "GET /{ad_account_id}?fields=balance,amount_spent,currency,funding_source_details,account_status,spend_cap",
      adimages: "GET /{ad_account_id}/adimages?hashes=[...]&fields=hash,url,url_1024",
      creativeThumbnail: "GET /{creative_id}?fields=thumbnail_url&thumbnail_width=1080&thumbnail_height=1080"
    },
    calculations: {
      ctr: "(clicks / impressions) * 100",
      cpm: "(spend / impressions) * 1000",
      cpc: "spend / clicks",
      cpa: "spend / conversions",
      cpl: "spend / leads",
      roas: "conversion_value / spend",
      frequency: "impressions / reach",
      daysRemaining: "FLOOR(account_balance / avgDailySpend)",
      avgDailySpend: "SUM(spend_last_7_days) / 7"
    }
  };

  return schema;
};

export const downloadDatabaseSchemaJSON = () => {
  const schema = generateDatabaseSchemaJSON();
  const content = JSON.stringify(schema, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `database-schema-v4-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
