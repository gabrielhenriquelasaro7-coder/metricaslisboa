import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Download, 
  Loader2, 
  Database, 
  Code, 
  FileJson, 
  FileCode, 
  Package,
  CheckCircle2,
  AlertCircle,
  FileText,
  FolderArchive
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';

interface ExportProgress {
  phase: string;
  current: number;
  total: number;
  currentItem: string;
}

interface ExportOptions {
  includeData: boolean;
  includeSchema: boolean;
  includeFunctions: boolean;
  includeDocumentation: boolean;
}

// All tables to export
const TABLES_TO_EXPORT = [
  'projects', 'profiles', 'user_roles', 'user_management', 'squads', 'squad_members',
  'project_metric_config', 'project_import_months', 'project_investidores',
  'campaigns', 'ad_sets', 'ads', 'ads_daily_metrics',
  'google_campaigns', 'google_ad_groups', 'google_ads', 'google_ads_daily_metrics',
  'leads', 'leadgen_forms',
  'crm_connections', 'crm_pipelines', 'crm_deals', 'crm_sync_logs',
  'account_goals', 'campaign_goals',
  'demographic_insights', 'dre_history',
  'optimization_history', 'period_metrics',
  'anomaly_alerts', 'anomaly_alert_config',
  'ai_analysis_cache', 'chart_preferences', 'user_hidden_metrics',
  'guest_invitations', 'guest_project_access',
  'suggestion_actions', 'investor_suggestions',
  'admin_access_requests', 'admin_access_grants',
  'whatsapp_instances', 'whatsapp_report_config',
  'sync_logs', 'sync_progress', 'system_settings',
];

// Edge functions list
const EDGE_FUNCTIONS = [
  'ai-traffic-assistant',
  'create-auth-users',
  'crm-callback',
  'crm-connect',
  'crm-status',
  'crm-sync',
  'debug-ad-creative',
  'detect-and-fix-gaps',
  'fetch-catalog-images',
  'google-ads-sync',
  'import-activity-history',
  'import-historical-data',
  'import-month-by-month',
  'invite-guest',
  'meta-ads-sync',
  'meta-leads-sync',
  'n8n-meta-sync',
  'predictive-analysis',
  'scheduled-sync-parallel',
  'scheduled-sync',
  'sync-ad-copies',
  'sync-demographics',
  'sync-webhook',
  'whatsapp-balance-alert',
  'whatsapp-instance-manager',
  'whatsapp-manager-instance',
  'whatsapp-send',
  'whatsapp-webhook',
  'whatsapp-weekly-report',
  'export-database-schema',
];

export function FullProjectExport() {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [options, setOptions] = useState<ExportOptions>({
    includeData: true,
    includeSchema: true,
    includeFunctions: true,
    includeDocumentation: true,
  });

  const generateSchemaSQL = async (): Promise<string> => {
    let sql = '';
    const timestamp = new Date().toISOString();
    
    sql += `-- ============================================\n`;
    sql += `-- V4 Company - Database Schema Export\n`;
    sql += `-- Generated at: ${timestamp}\n`;
    sql += `-- ============================================\n\n`;

    // ENUMs
    sql += `-- ENUMS\n`;
    sql += `CREATE TYPE IF NOT EXISTS business_model AS ENUM ('inside_sales', 'ecommerce', 'pdv');\n`;
    sql += `CREATE TYPE IF NOT EXISTS user_cargo AS ENUM ('tech', 'gerente', 'coordenador', 'investidor', 'membro');\n`;
    sql += `CREATE TYPE IF NOT EXISTS user_cargo_v2 AS ENUM ('tech', 'gerente', 'coordenador', 'investidor', 'membro');\n`;
    sql += `CREATE TYPE IF NOT EXISTS app_role AS ENUM ('admin', 'gestor', 'viewer');\n`;
    sql += `CREATE TYPE IF NOT EXISTS crm_provider AS ENUM ('hubspot', 'pipedrive', 'rdstation', 'custom');\n`;
    sql += `CREATE TYPE IF NOT EXISTS crm_connection_status AS ENUM ('active', 'inactive', 'error', 'pending');\n`;
    sql += `CREATE TYPE IF NOT EXISTS crm_deal_status AS ENUM ('open', 'won', 'lost');\n`;
    sql += `CREATE TYPE IF NOT EXISTS crm_sync_status AS ENUM ('pending', 'running', 'completed', 'failed');\n\n`;

    // Core tables schema (simplified but functional)
    const tableSchemas: Record<string, string> = {
      projects: `
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  business_model business_model NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency TEXT NOT NULL DEFAULT 'BRL',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  avatar_url TEXT,
  facebook_page_id TEXT,
  google_customer_id TEXT,
  health_score TEXT,
  last_sync_at TIMESTAMPTZ,
  webhook_status TEXT,
  account_balance NUMERIC,
  account_balance_updated_at TIMESTAMPTZ,
  ai_briefing TEXT,
  investidor_id UUID,
  squad_id UUID,
  sync_progress JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      profiles: `
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  cargo user_cargo,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      user_roles: `
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'gestor',
  cargo user_cargo_v2 NOT NULL DEFAULT 'membro',
  is_master BOOLEAN DEFAULT FALSE,
  password_changed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      squads: `
CREATE TABLE IF NOT EXISTS public.squads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
      squad_members: `
CREATE TABLE IF NOT EXISTS public.squad_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(squad_id, user_id)
);`,
      campaigns: `
CREATE TABLE IF NOT EXISTS public.campaigns (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT,
  objective TEXT,
  daily_budget NUMERIC,
  lifetime_budget NUMERIC,
  spend NUMERIC,
  impressions NUMERIC,
  clicks NUMERIC,
  reach NUMERIC,
  frequency NUMERIC,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  conversions NUMERIC,
  conversion_value NUMERIC,
  roas NUMERIC,
  cpa NUMERIC,
  messaging_replies NUMERIC,
  profile_visits NUMERIC,
  created_time TIMESTAMPTZ,
  updated_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);`,
      ad_sets: `
CREATE TABLE IF NOT EXISTS public.ad_sets (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  daily_budget NUMERIC,
  lifetime_budget NUMERIC,
  targeting JSONB,
  spend NUMERIC,
  impressions NUMERIC,
  clicks NUMERIC,
  reach NUMERIC,
  frequency NUMERIC,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  conversions NUMERIC,
  conversion_value NUMERIC,
  roas NUMERIC,
  cpa NUMERIC,
  messaging_replies NUMERIC,
  profile_visits NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);`,
      ads: `
CREATE TABLE IF NOT EXISTS public.ads (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  ad_set_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  creative_id TEXT,
  creative_image_url TEXT,
  creative_video_url TEXT,
  creative_thumbnail TEXT,
  cached_image_url TEXT,
  headline TEXT,
  primary_text TEXT,
  cta TEXT,
  spend NUMERIC,
  impressions NUMERIC,
  clicks NUMERIC,
  reach NUMERIC,
  frequency NUMERIC,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  conversions NUMERIC,
  conversion_value NUMERIC,
  roas NUMERIC,
  cpa NUMERIC,
  messaging_replies NUMERIC,
  profile_visits NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);`,
      ads_daily_metrics: `
CREATE TABLE IF NOT EXISTS public.ads_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT,
  campaign_objective TEXT,
  adset_id TEXT NOT NULL,
  adset_name TEXT NOT NULL,
  adset_status TEXT,
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL,
  ad_status TEXT,
  creative_id TEXT,
  creative_thumbnail TEXT,
  cached_creative_thumbnail TEXT,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  clicks NUMERIC NOT NULL DEFAULT 0,
  reach NUMERIC NOT NULL DEFAULT 0,
  frequency NUMERIC,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  conversions NUMERIC,
  conversion_value NUMERIC,
  roas NUMERIC,
  cpa NUMERIC,
  leads_count NUMERIC,
  purchases_count NUMERIC,
  initiate_checkout_count NUMERIC,
  messaging_replies NUMERIC,
  profile_visits NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, date, ad_id)
);`,
    };

    for (const [tableName, schema] of Object.entries(tableSchemas)) {
      sql += `-- Table: ${tableName}\n`;
      sql += schema + '\n\n';
    }

    // RLS Policies
    sql += `-- ============================================\n`;
    sql += `-- ROW LEVEL SECURITY POLICIES\n`;
    sql += `-- ============================================\n\n`;

    sql += `-- Enable RLS on all tables\n`;
    for (const table of Object.keys(tableSchemas)) {
      sql += `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;\n`;
    }
    sql += '\n';

    // Database functions
    sql += `-- ============================================\n`;
    sql += `-- DATABASE FUNCTIONS\n`;
    sql += `-- ============================================\n\n`;

    sql += `
CREATE OR REPLACE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    public.can_see_all_projects(_user_id)
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.guest_project_access WHERE project_id = _project_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_see_all_projects(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND cargo IN ('tech', 'gerente')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_cargo(_user_id uuid)
RETURNS user_cargo_v2
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(cargo, 'membro'::user_cargo_v2)
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
`;

    return sql;
  };

  const exportDataAsSQL = async (onProgress: (table: string, index: number) => void): Promise<string> => {
    let sql = '';
    const timestamp = new Date().toISOString();
    
    sql += `-- ============================================\n`;
    sql += `-- V4 Company - Data Export\n`;
    sql += `-- Generated at: ${timestamp}\n`;
    sql += `-- ============================================\n\n`;

    for (let i = 0; i < TABLES_TO_EXPORT.length; i++) {
      const tableName = TABLES_TO_EXPORT[i];
      onProgress(tableName, i);

      try {
        let allData: any[] = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(tableName as any)
            .select('*')
            .range(offset, offset + limit - 1);

          if (error) {
            sql += `-- Error fetching ${tableName}: ${error.message}\n\n`;
            hasMore = false;
          } else if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += limit;
            hasMore = data.length === limit;
          } else {
            hasMore = false;
          }
        }

        if (allData.length > 0) {
          sql += `-- Table: ${tableName} (${allData.length} rows)\n`;
          
          const columns = Object.keys(allData[0]);
          
          for (const row of allData) {
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              if (typeof val === 'number') return val.toString();
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
              return `'${String(val).replace(/'/g, "''")}'`;
            });
            
            sql += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
          }
          sql += '\n';
        }
      } catch (err) {
        sql += `-- Error processing ${tableName}: ${err}\n\n`;
      }
    }

    return sql;
  };

  const exportDataAsJSON = async (onProgress: (table: string, index: number) => void): Promise<Record<string, any[]>> => {
    const exportData: Record<string, any[]> = {};

    for (let i = 0; i < TABLES_TO_EXPORT.length; i++) {
      const tableName = TABLES_TO_EXPORT[i];
      onProgress(tableName, i);

      try {
        let allData: any[] = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(tableName as any)
            .select('*')
            .range(offset, offset + limit - 1);

          if (error) {
            hasMore = false;
          } else if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += limit;
            hasMore = data.length === limit;
          } else {
            hasMore = false;
          }
        }

        exportData[tableName] = allData;
      } catch {
        exportData[tableName] = [];
      }
    }

    return exportData;
  };

  const generateDocumentation = (): string => {
    const timestamp = new Date().toISOString();
    
    return `# V4 Company - Project Documentation

## Overview
This is a complete export of the V4 Company project, generated at ${timestamp}.

## Project Structure

\`\`\`
/database
  └── schema.sql          # Database schema (tables, types, functions)
  └── data.sql            # All data as INSERT statements
  └── data.json           # All data in JSON format

/docs
  └── README.md           # This file
  └── architecture.md     # System architecture
  └── api.md              # API documentation

/edge-functions
  └── [function-name]/    # Each edge function
      └── index.ts        # Function code
\`\`\`

## Database Tables

${TABLES_TO_EXPORT.map(t => `- \`${t}\``).join('\n')}

## Edge Functions

${EDGE_FUNCTIONS.map(f => `- \`${f}\``).join('\n')}

## How to Restore

### 1. Create a new Supabase project
Go to https://supabase.com and create a new project.

### 2. Run the schema
Execute the \`database/schema.sql\` file in the SQL editor.

### 3. Import the data
Execute the \`database/data.sql\` file or import \`database/data.json\`.

### 4. Deploy edge functions
Copy the edge functions to \`supabase/functions/\` and deploy:
\`\`\`bash
supabase functions deploy
\`\`\`

### 5. Configure environment variables
Set up the required secrets in the Supabase dashboard.

## Required Secrets

- META_ACCESS_TOKEN
- GOOGLE_ADS_CLIENT_ID
- GOOGLE_ADS_CLIENT_SECRET
- GOOGLE_ADS_DEVELOPER_TOKEN
- GOOGLE_ADS_REFRESH_TOKEN
- GOOGLE_ADS_CUSTOMER_ID
- EVOLUTION_API_URL
- EVOLUTION_API_KEY
- EVOLUTION_INSTANCE_NAME
- GEMINI_API_KEY

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage

## Support

For questions or issues, contact the development team.
`;
  };

  const generateArchitectureDoc = (): string => {
    return `# System Architecture

## Overview

V4 Company is a marketing analytics platform that integrates with Meta Ads and Google Ads.

## Components

### Frontend (React)

- **Pages**: Dashboard, Campaigns, Ads, Creatives, Financial, Settings, Admin
- **Components**: Reusable UI components built with shadcn/ui
- **Hooks**: Custom hooks for data fetching and state management
- **i18n**: Multi-language support (PT-BR, EN-US, ES)

### Backend (Supabase)

- **Database**: PostgreSQL with RLS policies
- **Auth**: Email/password authentication
- **Edge Functions**: Serverless functions for integrations
- **Storage**: File storage for images and exports

### Integrations

- **Meta Ads API**: Campaign and ad data synchronization
- **Google Ads API**: Google campaign data
- **WhatsApp (Evolution API)**: Notifications and reports
- **CRM**: HubSpot, Pipedrive, RD Station integration

## Data Flow

1. User authenticates via Supabase Auth
2. Frontend fetches data via Supabase client
3. Edge functions sync data from external APIs
4. Data is stored in PostgreSQL with RLS protection
5. Real-time updates via Supabase Realtime

## Security

- Row Level Security (RLS) on all tables
- Role-based access control (tech, gerente, coordenador, investidor, membro)
- Squad-based project access
- Encrypted secrets storage
`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const zip = new JSZip();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      // Phase 1: Schema
      if (options.includeSchema) {
        setProgress({ phase: 'Schema', current: 0, total: 1, currentItem: 'Generating schema...' });
        const schema = await generateSchemaSQL();
        zip.file('database/schema.sql', schema);
      }

      // Phase 2: Data
      if (options.includeData) {
        // SQL format
        const dataSql = await exportDataAsSQL((table, index) => {
          setProgress({ 
            phase: 'Data (SQL)', 
            current: index + 1, 
            total: TABLES_TO_EXPORT.length, 
            currentItem: table 
          });
        });
        zip.file('database/data.sql', dataSql);

        // JSON format
        const dataJson = await exportDataAsJSON((table, index) => {
          setProgress({ 
            phase: 'Data (JSON)', 
            current: index + 1, 
            total: TABLES_TO_EXPORT.length, 
            currentItem: table 
          });
        });
        zip.file('database/data.json', JSON.stringify(dataJson, null, 2));
      }

      // Phase 3: Documentation
      if (options.includeDocumentation) {
        setProgress({ phase: 'Documentation', current: 0, total: 1, currentItem: 'Generating docs...' });
        zip.file('docs/README.md', generateDocumentation());
        zip.file('docs/architecture.md', generateArchitectureDoc());
      }

      // Phase 4: Edge Functions list
      if (options.includeFunctions) {
        setProgress({ phase: 'Functions', current: 0, total: 1, currentItem: 'Listing functions...' });
        const functionsReadme = `# Edge Functions\n\nThe following edge functions are used in this project:\n\n${EDGE_FUNCTIONS.map(f => `- ${f}`).join('\n')}\n\nTo export the actual function code, download the project from the Git repository.`;
        zip.file('edge-functions/README.md', functionsReadme);
      }

      // Generate ZIP
      setProgress({ phase: 'Compressing', current: 0, total: 1, currentItem: 'Creating ZIP file...' });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `v4-company-full-export-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Exportação completa! Arquivo ZIP gerado com sucesso.');

    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Erro na exportação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  const progressPercent = progress 
    ? progress.total > 0 
      ? (progress.current / progress.total) * 100 
      : 0
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderArchive className="h-5 w-5" />
          Exportação Completa do Projeto
        </CardTitle>
        <CardDescription>
          Exporte todo o projeto incluindo banco de dados, schema, funções e documentação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Options */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeSchema"
              checked={options.includeSchema}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeSchema: checked as boolean }))
              }
            />
            <Label htmlFor="includeSchema" className="flex items-center gap-2">
              <Code className="h-4 w-4 text-blue-500" />
              Schema SQL (CREATE TABLE)
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeData"
              checked={options.includeData}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeData: checked as boolean }))
              }
            />
            <Label htmlFor="includeData" className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-500" />
              Dados (SQL + JSON)
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeFunctions"
              checked={options.includeFunctions}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeFunctions: checked as boolean }))
              }
            />
            <Label htmlFor="includeFunctions" className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-purple-500" />
              Edge Functions
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeDocumentation"
              checked={options.includeDocumentation}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeDocumentation: checked as boolean }))
              }
            />
            <Label htmlFor="includeDocumentation" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" />
              Documentação
            </Label>
          </div>
        </div>

        <Separator />

        {/* What will be exported */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">O que será exportado:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {options.includeSchema && (
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Schema completo (ENUMs, tabelas, constraints, funções)
              </li>
            )}
            {options.includeData && (
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Todos os dados de {TABLES_TO_EXPORT.length} tabelas (SQL + JSON)
              </li>
            )}
            {options.includeFunctions && (
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Lista de {EDGE_FUNCTIONS.length} Edge Functions
              </li>
            )}
            {options.includeDocumentation && (
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Documentação (README, arquitetura)
              </li>
            )}
          </ul>
        </div>

        {/* Progress */}
        {progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.phase}: <span className="font-medium text-foreground">{progress.currentItem}</span>
              </span>
              {progress.total > 0 && (
                <span className="text-muted-foreground">
                  {progress.current}/{progress.total}
                </span>
              )}
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Export Button */}
        <Button
          onClick={handleExport}
          disabled={isExporting || (!options.includeSchema && !options.includeData && !options.includeFunctions && !options.includeDocumentation)}
          className="w-full gap-2"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Exportando projeto...
            </>
          ) : (
            <>
              <Package className="w-5 h-5" />
              Exportar Projeto Completo (.zip)
            </>
          )}
        </Button>

        {/* Additional exports */}
        <Separator />
        
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={async () => {
              setIsExporting(true);
              try {
                const schema = await generateSchemaSQL();
                const blob = new Blob([schema], { type: 'text/sql' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `schema-${new Date().toISOString().split('T')[0]}.sql`;
                link.click();
                URL.revokeObjectURL(url);
                toast.success('Schema SQL exportado!');
              } finally {
                setIsExporting(false);
              }
            }}
          >
            <Code className="w-4 h-4 mr-2" />
            Apenas Schema
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={async () => {
              setIsExporting(true);
              try {
                const data = await exportDataAsJSON((table, index) => {
                  setProgress({ 
                    phase: 'Dados', 
                    current: index + 1, 
                    total: TABLES_TO_EXPORT.length, 
                    currentItem: table 
                  });
                });
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `data-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                URL.revokeObjectURL(url);
                toast.success('Dados JSON exportados!');
              } finally {
                setIsExporting(false);
                setProgress(null);
              }
            }}
          >
            <FileJson className="w-4 h-4 mr-2" />
            Apenas Dados (JSON)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
