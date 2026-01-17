import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  AlertTriangle,
  FileText,
  FolderArchive,
  Shield,
  Key,
  HardDrive
} from 'lucide-react';
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
  includeRLSPolicies: boolean;
  includeFunctions: boolean;
  includeDocumentation: boolean;
  includeStorageInfo: boolean;
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
  'ai-traffic-assistant', 'create-auth-users', 'crm-callback', 'crm-connect',
  'crm-status', 'crm-sync', 'debug-ad-creative', 'detect-and-fix-gaps',
  'fetch-catalog-images', 'google-ads-sync', 'import-activity-history',
  'import-historical-data', 'import-month-by-month', 'invite-guest',
  'meta-ads-sync', 'meta-leads-sync', 'n8n-meta-sync', 'predictive-analysis',
  'scheduled-sync-parallel', 'scheduled-sync', 'sync-ad-copies',
  'sync-demographics', 'sync-webhook', 'whatsapp-balance-alert',
  'whatsapp-instance-manager', 'whatsapp-manager-instance', 'whatsapp-send',
  'whatsapp-webhook', 'whatsapp-weekly-report', 'export-database-schema',
];

// Required secrets
const REQUIRED_SECRETS = [
  { name: 'META_ACCESS_TOKEN', description: 'Token de acesso da Meta Ads API' },
  { name: 'GOOGLE_ADS_CLIENT_ID', description: 'Client ID do Google Ads' },
  { name: 'GOOGLE_ADS_CLIENT_SECRET', description: 'Client Secret do Google Ads' },
  { name: 'GOOGLE_ADS_DEVELOPER_TOKEN', description: 'Developer Token do Google Ads' },
  { name: 'GOOGLE_ADS_REFRESH_TOKEN', description: 'Refresh Token do Google Ads' },
  { name: 'GOOGLE_ADS_CUSTOMER_ID', description: 'Customer ID do Google Ads' },
  { name: 'EVOLUTION_API_URL', description: 'URL da Evolution API (WhatsApp)' },
  { name: 'EVOLUTION_API_KEY', description: 'API Key da Evolution API' },
  { name: 'EVOLUTION_INSTANCE_NAME', description: 'Nome da instância Evolution' },
  { name: 'GEMINI_API_KEY', description: 'API Key do Google Gemini (IA)' },
];

// Storage buckets
const STORAGE_BUCKETS = [
  { name: 'project-avatars', public: true, description: 'Avatares dos projetos' },
  { name: 'creative-images', public: true, description: 'Imagens de criativos' },
  { name: 'creative-cache', public: true, description: 'Cache de criativos' },
  { name: 'project-logos', public: true, description: 'Logos dos projetos' },
];

export function FullProjectExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [options, setOptions] = useState<ExportOptions>({
    includeData: true,
    includeSchema: true,
    includeRLSPolicies: true,
    includeFunctions: true,
    includeDocumentation: true,
    includeStorageInfo: true,
  });

  // Generate complete schema SQL with ENUMs
  const generateSchemaSQL = async (): Promise<string> => {
    let sql = '';
    const timestamp = new Date().toISOString();
    
    sql += `-- ============================================\n`;
    sql += `-- V4 Company - Complete Database Schema Export\n`;
    sql += `-- Generated at: ${timestamp}\n`;
    sql += `-- INCLUDES: ENUMs, Tables, Constraints, Functions\n`;
    sql += `-- ============================================\n\n`;

    // ENUMs
    sql += `-- ============================================\n`;
    sql += `-- ENUMS (Custom Types)\n`;
    sql += `-- ============================================\n\n`;
    
    sql += `CREATE TYPE public.business_model AS ENUM ('inside_sales', 'ecommerce', 'pdv');\n\n`;
    sql += `CREATE TYPE public.user_cargo AS ENUM ('tech', 'gerente', 'coordenador', 'investidor', 'membro');\n\n`;
    sql += `CREATE TYPE public.user_cargo_v2 AS ENUM ('tech', 'gerente', 'coordenador', 'investidor', 'membro');\n\n`;
    sql += `CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'viewer');\n\n`;
    sql += `CREATE TYPE public.crm_provider AS ENUM ('hubspot', 'pipedrive', 'rdstation', 'custom');\n\n`;
    sql += `CREATE TYPE public.crm_connection_status AS ENUM ('active', 'inactive', 'error', 'pending');\n\n`;
    sql += `CREATE TYPE public.crm_deal_status AS ENUM ('open', 'won', 'lost');\n\n`;
    sql += `CREATE TYPE public.crm_sync_status AS ENUM ('pending', 'running', 'completed', 'failed');\n\n`;

    // Tables
    sql += `-- ============================================\n`;
    sql += `-- TABLES\n`;
    sql += `-- ============================================\n\n`;

    // Core tables with full definitions
    const tableDefinitions = getCompleteTableDefinitions();
    sql += tableDefinitions;

    return sql;
  };

  // Generate RLS policies SQL
  const generateRLSPoliciesSQL = async (): Promise<string> => {
    let sql = '';
    const timestamp = new Date().toISOString();
    
    sql += `-- ============================================\n`;
    sql += `-- V4 Company - Row Level Security Policies\n`;
    sql += `-- Generated at: ${timestamp}\n`;
    sql += `-- ============================================\n\n`;

    // Fetch actual RLS policies from database
    const { data: policies, error } = await supabase.rpc('get_rls_policies' as any);
    
    if (error || !policies) {
      // Fallback to predefined policies
      sql += getRLSPoliciesFallback();
    } else {
      for (const policy of policies as any[]) {
        sql += `-- Policy: ${policy.policyname} on ${policy.tablename}\n`;
        sql += `CREATE POLICY "${policy.policyname}"\n`;
        sql += `  ON public.${policy.tablename}\n`;
        sql += `  FOR ${policy.cmd}\n`;
        sql += `  TO ${policy.roles?.replace(/[{}]/g, '') || 'public'}\n`;
        if (policy.qual) {
          sql += `  USING (${policy.qual})\n`;
        }
        if (policy.with_check) {
          sql += `  WITH CHECK (${policy.with_check})\n`;
        }
        sql += `;\n\n`;
      }
    }

    return sql;
  };

  // Generate database functions SQL
  const generateFunctionsSQL = (): string => {
    let sql = '';
    const timestamp = new Date().toISOString();
    
    sql += `-- ============================================\n`;
    sql += `-- V4 Company - Database Functions & Triggers\n`;
    sql += `-- Generated at: ${timestamp}\n`;
    sql += `-- ============================================\n\n`;

    // All database functions
    sql += `
-- Function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function: get_user_cargo
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

-- Function: has_cargo
CREATE OR REPLACE FUNCTION public.has_cargo(_user_id uuid, _cargo user_cargo_v2)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND cargo = _cargo
  )
$$;

-- Function: can_see_all_projects
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

-- Function: can_view_project
CREATE OR REPLACE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    public.can_see_all_projects(_user_id)
    OR (
      public.get_user_cargo(_user_id) = 'coordenador' 
      AND EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.squad_members sm ON sm.squad_id = p.squad_id
        WHERE p.id = _project_id AND sm.user_id = _user_id
      )
    )
    OR (
      public.get_user_cargo(_user_id) = 'investidor'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = _project_id AND p.investidor_id = _user_id
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.guest_project_access
      WHERE project_id = _project_id AND user_id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = _project_id AND user_id = _user_id
    )
$$;

-- Function: user_has_project_access
CREATE OR REPLACE FUNCTION public.user_has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.guest_project_access 
    WHERE project_id = _project_id AND user_id = _user_id
  )
$$;

-- Function: get_user_squad_ids
CREATE OR REPLACE FUNCTION public.get_user_squad_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(squad_id), ARRAY[]::uuid[])
  FROM public.squad_members
  WHERE user_id = _user_id
$$;

-- Function: needs_password_change
CREATE OR REPLACE FUNCTION public.needs_password_change(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT NOT password_changed FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    false
  )
$$;

-- Function: is_master_user
CREATE OR REPLACE FUNCTION public.is_master_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_master FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    FALSE
  )
$$;

-- Function: has_admin_access
CREATE OR REPLACE FUNCTION public.has_admin_access(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_access_grants
    WHERE user_id = check_user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Function: has_project_admin_access
CREATE OR REPLACE FUNCTION public.has_project_admin_access(check_user_id uuid, check_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_access_grants
    WHERE user_id = check_user_id
      AND (project_id = check_project_id OR project_id IS NULL)
      AND expires_at > now()
  )
$$;

-- Function: update_updated_at_column (Trigger Function)
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

-- Function: handle_new_user (Trigger for creating profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Function: handle_new_user_role (Trigger for default role)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'gestor');
  RETURN NEW;
END;
$$;
`;

    return sql;
  };

  // Export data as SQL INSERT statements
  const exportDataAsSQL = async (onProgress: (table: string, index: number) => void): Promise<string> => {
    let sql = '';
    const timestamp = new Date().toISOString();
    
    sql += `-- ============================================\n`;
    sql += `-- V4 Company - Data Export (INSERT Statements)\n`;
    sql += `-- Generated at: ${timestamp}\n`;
    sql += `-- Total tables: ${TABLES_TO_EXPORT.length}\n`;
    sql += `-- ============================================\n\n`;

    sql += `-- IMPORTANT: Run schema.sql BEFORE running this file\n\n`;

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
          sql += `-- ============================================\n`;
          sql += `-- Table: ${tableName} (${allData.length} rows)\n`;
          sql += `-- ============================================\n\n`;
          
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

  // Export data as JSON
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

  // Generate complete documentation
  const generateDocumentation = (dataStats: Record<string, number>): string => {
    const timestamp = new Date().toISOString();
    const totalRecords = Object.values(dataStats).reduce((sum, count) => sum + count, 0);
    
    return `# V4 Company - Complete Project Export

## 📋 Overview
This is a **COMPLETE** export of the V4 Company project, containing everything needed to recreate the system from scratch.

**Generated at:** ${timestamp}
**Total Records:** ${totalRecords.toLocaleString()}
**Total Tables:** ${TABLES_TO_EXPORT.length}

## 📁 Export Contents

\`\`\`
v4-company-full-export/
├── database/
│   ├── 01_schema.sql           # ENUMs, Tables, Constraints
│   ├── 02_functions.sql        # Database functions & triggers
│   ├── 03_rls_policies.sql     # Row Level Security policies
│   ├── 04_data.sql             # All data as INSERT statements
│   └── data.json               # All data in JSON format
├── edge-functions/
│   └── README.md               # List of all edge functions
├── storage/
│   └── buckets.sql             # Storage bucket configurations
├── secrets/
│   └── .env.example            # Required environment variables
└── docs/
    ├── README.md               # This file
    ├── architecture.md         # System architecture
    ├── restore-guide.md        # Step-by-step restore guide
    └── data-stats.json         # Export statistics
\`\`\`

## 🚀 How to Restore (Step-by-Step)

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Create a new project
3. Wait for the project to be ready

### Step 2: Run Database Scripts (IN ORDER!)
\`\`\`bash
# 1. First, run the schema (creates types and tables)
psql -h [HOST] -U postgres -d postgres -f database/01_schema.sql

# 2. Then, create the functions
psql -h [HOST] -U postgres -d postgres -f database/02_functions.sql

# 3. Apply RLS policies
psql -h [HOST] -U postgres -d postgres -f database/03_rls_policies.sql

# 4. Finally, import the data
psql -h [HOST] -U postgres -d postgres -f database/04_data.sql
\`\`\`

Or use the Supabase SQL Editor in the dashboard.

### Step 3: Configure Storage Buckets
Run \`storage/buckets.sql\` in the SQL Editor.

### Step 4: Deploy Edge Functions
1. Clone the frontend repository
2. Copy edge functions to \`supabase/functions/\`
3. Run: \`supabase functions deploy --all\`

### Step 5: Configure Secrets
Add all secrets from \`secrets/.env.example\` to:
- Supabase Dashboard → Settings → Edge Functions → Secrets

### Step 6: Deploy Frontend
1. Update \`.env\` with new Supabase URL and Key
2. Run: \`npm install && npm run build\`
3. Deploy to your hosting provider

## 📊 Data Statistics

| Table | Records |
|-------|---------|
${Object.entries(dataStats).map(([table, count]) => `| ${table} | ${count.toLocaleString()} |`).join('\n')}
| **TOTAL** | **${totalRecords.toLocaleString()}** |

## 🔐 Required Secrets

${REQUIRED_SECRETS.map(s => `- \`${s.name}\`: ${s.description}`).join('\n')}

## 📦 Storage Buckets

${STORAGE_BUCKETS.map(b => `- \`${b.name}\`: ${b.description} (${b.public ? 'public' : 'private'})`).join('\n')}

## ⚠️ Important Notes

1. **Order matters**: Run SQL files in numbered order (01, 02, 03, 04)
2. **Auth users**: User accounts need to be recreated via Supabase Auth
3. **Storage files**: Images/files in storage buckets are NOT included
4. **Secrets**: You need to reconfigure all API keys and tokens

## 🛠️ Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **UI Library**: shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage

## 📞 Support

For questions about this export or restoration process, contact the development team.

---
*Generated by V4 Company Export System*
`;
  };

  // Generate restore guide
  const generateRestoreGuide = (): string => {
    return `# V4 Company - Restore Guide

## Pre-requisites

- Node.js 18+
- npm or yarn
- Supabase CLI (optional, for edge functions)
- PostgreSQL client (psql) or access to Supabase SQL Editor

## Detailed Restoration Steps

### 1. Create New Supabase Project

1. Visit https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization
4. Set project name and database password
5. Select region closest to your users
6. Wait for project initialization (~2 minutes)

### 2. Get Database Credentials

From your Supabase dashboard:
- Go to Settings → Database
- Copy the connection string
- Note the project URL and anon key

### 3. Apply Database Schema

Option A - Via SQL Editor:
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of \`database/01_schema.sql\`
3. Run the query
4. Repeat for 02, 03, 04 files in order

Option B - Via psql:
\`\`\`bash
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
psql $DATABASE_URL -f database/01_schema.sql
psql $DATABASE_URL -f database/02_functions.sql
psql $DATABASE_URL -f database/03_rls_policies.sql
psql $DATABASE_URL -f database/04_data.sql
\`\`\`

### 4. Configure Storage

Run in SQL Editor:
\`\`\`sql
-- From storage/buckets.sql
INSERT INTO storage.buckets (id, name, public) VALUES ('project-avatars', 'project-avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('creative-images', 'creative-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('creative-cache', 'creative-cache', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('project-logos', 'project-logos', true);
\`\`\`

### 5. Configure Auth

1. Go to Authentication → Providers
2. Enable Email provider
3. Configure any OAuth providers if needed
4. Go to Authentication → Settings
5. Enable/disable email confirmation as needed

### 6. Deploy Edge Functions

\`\`\`bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref [YOUR-PROJECT-REF]

# Deploy all functions
supabase functions deploy --all
\`\`\`

### 7. Configure Secrets

In Supabase Dashboard → Settings → Edge Functions → Secrets:

Add each secret from \`.env.example\`:
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

### 8. Configure Frontend

1. Clone/download the frontend code
2. Create \`.env\` file:
\`\`\`
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[YOUR-ANON-KEY]
\`\`\`
3. Install dependencies: \`npm install\`
4. Build: \`npm run build\`
5. Deploy to your hosting (Vercel, Netlify, etc.)

### 9. Recreate Users

User passwords are not included in the export for security.
You need to:
1. Have users reset their passwords, OR
2. Use the Supabase Dashboard to manually set passwords

### 10. Verify Installation

1. Access your deployed frontend
2. Try to login with a test account
3. Check if data loads correctly
4. Test sync functionality

## Troubleshooting

### "relation does not exist"
- Make sure you ran the SQL files in order (01, 02, 03, 04)

### "permission denied"
- Check if RLS policies were applied correctly
- Verify user roles are correct

### Edge function errors
- Check if all secrets are configured
- View function logs in Supabase Dashboard

### Data not loading
- Verify CORS settings
- Check browser console for errors
- Verify Supabase URL and key in .env

---
*V4 Company Export System*
`;
  };

  // Generate .env.example
  const generateEnvExample = (): string => {
    return `# V4 Company - Environment Variables
# Copy this file to .env and fill in the values

# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here

# The following secrets should be configured in Supabase Dashboard
# Settings → Edge Functions → Secrets

# Meta Ads Integration
# META_ACCESS_TOKEN=your-meta-access-token

# Google Ads Integration
# GOOGLE_ADS_CLIENT_ID=your-client-id
# GOOGLE_ADS_CLIENT_SECRET=your-client-secret
# GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
# GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
# GOOGLE_ADS_CUSTOMER_ID=your-customer-id

# WhatsApp (Evolution API) Integration
# EVOLUTION_API_URL=https://your-evolution-api.com
# EVOLUTION_API_KEY=your-api-key
# EVOLUTION_INSTANCE_NAME=your-instance-name

# AI (Gemini) Integration
# GEMINI_API_KEY=your-gemini-api-key
`;
  };

  // Generate storage buckets SQL
  const generateStorageSQL = (): string => {
    let sql = `-- V4 Company - Storage Buckets Configuration
-- Run this in the SQL Editor after creating the database

`;
    for (const bucket of STORAGE_BUCKETS) {
      sql += `-- ${bucket.description}\n`;
      sql += `INSERT INTO storage.buckets (id, name, public) VALUES ('${bucket.name}', '${bucket.name}', ${bucket.public}) ON CONFLICT DO NOTHING;\n\n`;
    }
    return sql;
  };

  // Main export handler
  const handleExport = async () => {
    setIsExporting(true);
    const dataStats: Record<string, number> = {};
    
    try {
      const zip = new JSZip();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      // Phase 1: Schema
      if (options.includeSchema) {
        setProgress({ phase: 'Schema', current: 0, total: 1, currentItem: 'Generating database schema...' });
        const schema = await generateSchemaSQL();
        zip.file('database/01_schema.sql', schema);
      }

      // Phase 2: Functions
      if (options.includeFunctions) {
        setProgress({ phase: 'Functions', current: 0, total: 1, currentItem: 'Generating database functions...' });
        const functions = generateFunctionsSQL();
        zip.file('database/02_functions.sql', functions);
      }

      // Phase 3: RLS Policies
      if (options.includeRLSPolicies) {
        setProgress({ phase: 'RLS Policies', current: 0, total: 1, currentItem: 'Generating security policies...' });
        const rlsPolicies = await generateRLSPoliciesSQL();
        zip.file('database/03_rls_policies.sql', rlsPolicies);
      }

      // Phase 4: Data
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
        zip.file('database/04_data.sql', dataSql);

        // JSON format
        const dataJson = await exportDataAsJSON((table, index) => {
          setProgress({ 
            phase: 'Data (JSON)', 
            current: index + 1, 
            total: TABLES_TO_EXPORT.length, 
            currentItem: table 
          });
          dataStats[table] = 0; // Will be updated
        });
        
        // Update stats
        for (const [table, data] of Object.entries(dataJson)) {
          dataStats[table] = data.length;
        }
        
        zip.file('database/data.json', JSON.stringify(dataJson, null, 2));
      }

      // Phase 5: Storage
      if (options.includeStorageInfo) {
        setProgress({ phase: 'Storage', current: 0, total: 1, currentItem: 'Generating storage config...' });
        zip.file('storage/buckets.sql', generateStorageSQL());
      }

      // Phase 6: Secrets
      setProgress({ phase: 'Secrets', current: 0, total: 1, currentItem: 'Generating env template...' });
      zip.file('secrets/.env.example', generateEnvExample());

      // Phase 7: Edge Functions
      setProgress({ phase: 'Edge Functions', current: 0, total: 1, currentItem: 'Documenting functions...' });
      const functionsReadme = `# Edge Functions

The following ${EDGE_FUNCTIONS.length} edge functions are used in this project:

${EDGE_FUNCTIONS.map((f, i) => `${i + 1}. \`${f}\``).join('\n')}

## Deployment

To deploy edge functions, you need the source code from the Git repository.

\`\`\`bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# Deploy all functions
supabase functions deploy --all
\`\`\`

## Important Notes

- Edge function code is stored in \`supabase/functions/\` directory
- Each function has its own folder with \`index.ts\`
- Configure secrets in Supabase Dashboard before deploying
`;
      zip.file('edge-functions/README.md', functionsReadme);

      // Phase 8: Documentation
      if (options.includeDocumentation) {
        setProgress({ phase: 'Documentation', current: 0, total: 1, currentItem: 'Generating docs...' });
        zip.file('docs/README.md', generateDocumentation(dataStats));
        zip.file('docs/restore-guide.md', generateRestoreGuide());
        zip.file('docs/data-stats.json', JSON.stringify(dataStats, null, 2));
      }

      // Generate ZIP
      setProgress({ phase: 'Compressing', current: 0, total: 1, currentItem: 'Creating ZIP file...' });
      const blob = await zip.generateAsync({ 
        type: 'blob', 
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `v4-company-full-export-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalRecords = Object.values(dataStats).reduce((sum, count) => sum + count, 0);
      toast.success(`Exportação completa! ${totalRecords.toLocaleString()} registros exportados.`);

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
          Exporte ABSOLUTAMENTE TUDO para migrar o projeto para qualquer lugar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning Alert */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Importante</AlertTitle>
          <AlertDescription>
            Este export contém todo o necessário para recriar o banco de dados. 
            O código fonte (frontend + edge functions) deve ser obtido do repositório Git.
            Senhas de usuários e arquivos do storage NÃO são incluídos por segurança.
          </AlertDescription>
        </Alert>

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
              <Database className="h-4 w-4 text-blue-500" />
              Schema (Tables, ENUMs)
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
              <Code className="h-4 w-4 text-purple-500" />
              DB Functions & Triggers
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeRLSPolicies"
              checked={options.includeRLSPolicies}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeRLSPolicies: checked as boolean }))
              }
            />
            <Label htmlFor="includeRLSPolicies" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              RLS Policies (Segurança)
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
              <FileJson className="h-4 w-4 text-amber-500" />
              Todos os Dados (SQL + JSON)
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeStorageInfo"
              checked={options.includeStorageInfo}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeStorageInfo: checked as boolean }))
              }
            />
            <Label htmlFor="includeStorageInfo" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-cyan-500" />
              Storage Buckets Config
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
              Documentação Completa
            </Label>
          </div>
        </div>

        <Separator />

        {/* What will be exported */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">O ZIP incluirá:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">📁 database/</p>
              <ul className="text-muted-foreground space-y-0.5 ml-4">
                <li>• 01_schema.sql - Tabelas e tipos</li>
                <li>• 02_functions.sql - Funções do banco</li>
                <li>• 03_rls_policies.sql - Políticas RLS</li>
                <li>• 04_data.sql - Dados em INSERT</li>
                <li>• data.json - Dados em JSON</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">📁 outros/</p>
              <ul className="text-muted-foreground space-y-0.5 ml-4">
                <li>• storage/buckets.sql</li>
                <li>• secrets/.env.example</li>
                <li>• edge-functions/README.md</li>
                <li>• docs/README.md</li>
                <li>• docs/restore-guide.md</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{progress.phase}</span>: {progress.currentItem}
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
          disabled={isExporting || Object.values(options).every(v => !v)}
          className="w-full gap-2"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Exportando projeto completo...
            </>
          ) : (
            <>
              <Package className="w-5 h-5" />
              Exportar TUDO (.zip)
            </>
          )}
        </Button>

        {/* Info about what's NOT included */}
        <Alert variant="default" className="bg-muted/50">
          <Key className="h-4 w-4" />
          <AlertTitle>O que NÃO está incluído (por segurança)</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>• <strong>Senhas de usuários</strong> - Precisam ser redefinidas</p>
            <p>• <strong>Arquivos do Storage</strong> - Imagens/uploads (exporte manualmente se necessário)</p>
            <p>• <strong>Valores dos Secrets</strong> - Apenas template .env.example</p>
            <p>• <strong>Código fonte</strong> - Obtenha via Git (frontend + edge functions)</p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// Helper function to get complete table definitions
function getCompleteTableDefinitions(): string {
  return `
-- ============================================
-- Table: projects
-- ============================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  business_model public.business_model NOT NULL,
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
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_squad_id ON public.projects(squad_id);

-- ============================================
-- Table: profiles
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  cargo public.user_cargo,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Table: user_roles
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'gestor',
  cargo public.user_cargo_v2 NOT NULL DEFAULT 'membro',
  is_master BOOLEAN DEFAULT FALSE,
  password_changed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Table: squads
-- ============================================
CREATE TABLE IF NOT EXISTS public.squads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Table: squad_members
-- ============================================
CREATE TABLE IF NOT EXISTS public.squad_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(squad_id, user_id)
);
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Table: campaigns
-- ============================================
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
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_campaigns_project_id ON public.campaigns(project_id);

-- ============================================
-- Table: ad_sets
-- ============================================
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
);
ALTER TABLE public.ad_sets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ad_sets_project_id ON public.ad_sets(project_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign_id ON public.ad_sets(campaign_id);

-- ============================================
-- Table: ads
-- ============================================
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
);
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ads_project_id ON public.ads(project_id);

-- ============================================
-- Table: ads_daily_metrics
-- ============================================
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
);
ALTER TABLE public.ads_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ads_daily_metrics_project_date ON public.ads_daily_metrics(project_id, date);

-- ============================================
-- Table: google_campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS public.google_campaigns (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT,
  campaign_type TEXT,
  bidding_strategy TEXT,
  budget_type TEXT,
  budget_amount NUMERIC,
  start_date TEXT,
  end_date TEXT,
  spend NUMERIC,
  impressions NUMERIC,
  clicks NUMERIC,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  conversions NUMERIC,
  conversion_value NUMERIC,
  roas NUMERIC,
  cost_per_conversion NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);
ALTER TABLE public.google_campaigns ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Table: google_ad_groups
-- ============================================
CREATE TABLE IF NOT EXISTS public.google_ad_groups (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  cpc_bid NUMERIC,
  spend NUMERIC,
  impressions NUMERIC,
  clicks NUMERIC,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  conversions NUMERIC,
  conversion_value NUMERIC,
  roas NUMERIC,
  cost_per_conversion NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);
ALTER TABLE public.google_ad_groups ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Table: google_ads
-- ============================================
CREATE TABLE IF NOT EXISTS public.google_ads (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  ad_group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  ad_type TEXT,
  headlines TEXT[],
  descriptions TEXT[],
  final_urls TEXT[],
  spend NUMERIC,
  impressions NUMERIC,
  clicks NUMERIC,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  conversions NUMERIC,
  conversion_value NUMERIC,
  roas NUMERIC,
  cost_per_conversion NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);
ALTER TABLE public.google_ads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Table: google_ads_daily_metrics
-- ============================================
CREATE TABLE IF NOT EXISTS public.google_ads_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT,
  campaign_type TEXT,
  ad_group_id TEXT NOT NULL,
  ad_group_name TEXT NOT NULL,
  ad_group_status TEXT,
  ad_id TEXT NOT NULL,
  ad_name TEXT NOT NULL,
  ad_status TEXT,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  clicks NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  conversions NUMERIC,
  conversion_value NUMERIC,
  roas NUMERIC,
  cost_per_conversion NUMERIC,
  search_impression_share NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.google_ads_daily_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Additional tables (simplified definitions)
-- ============================================

CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT NOT NULL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  form_name TEXT,
  campaign_id TEXT,
  adset_id TEXT,
  ad_id TEXT,
  ad_name TEXT,
  created_time TIMESTAMPTZ NOT NULL,
  lead_name TEXT,
  lead_email TEXT,
  lead_phone TEXT,
  field_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.guest_project_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.guest_project_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.account_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  target_spend_daily NUMERIC,
  target_spend_monthly NUMERIC,
  target_leads_monthly NUMERIC,
  target_cpl NUMERIC,
  target_ctr NUMERIC,
  target_cpc NUMERIC,
  target_roas NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_goals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dre_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  gross_revenue NUMERIC,
  deductions NUMERIC,
  net_revenue NUMERIC,
  ad_spend_meta NUMERIC,
  ad_spend_google NUMERIC,
  ad_spend_other NUMERIC,
  total_ad_spend NUMERIC,
  operational_expenses NUMERIC,
  contribution_margin NUMERIC,
  ebitda NUMERIC,
  total_leads NUMERIC,
  total_mql NUMERIC,
  total_sql NUMERIC,
  total_sales NUMERIC,
  cpl NUMERIC,
  cac NUMERIC,
  roas NUMERIC,
  conversion_rate NUMERIC,
  average_ticket NUMERIC,
  custom_expenses JSONB,
  custom_deductions JSONB,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dre_history ENABLE ROW LEVEL SECURITY;

-- Add remaining tables as needed...
`;
}

// Fallback RLS policies when can't fetch from database
function getRLSPoliciesFallback(): string {
  return `
-- ============================================
-- RLS Policies - Fallback (generated from known patterns)
-- ============================================

-- Projects policies
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Tech and Gerente can view all projects" ON public.projects FOR SELECT USING (public.can_see_all_projects(auth.uid()));

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Tech can manage all roles" ON public.user_roles FOR ALL USING (public.has_cargo(auth.uid(), 'tech'));

-- Campaigns policies
CREATE POLICY "Users can view campaigns for their projects" ON public.campaigns FOR SELECT USING (public.user_has_project_access(auth.uid(), project_id));

-- Ad sets policies
CREATE POLICY "Users can view ad_sets for their projects" ON public.ad_sets FOR SELECT USING (public.user_has_project_access(auth.uid(), project_id));

-- Ads policies
CREATE POLICY "Users can view ads for their projects" ON public.ads FOR SELECT USING (public.user_has_project_access(auth.uid(), project_id));

-- Daily metrics policies
CREATE POLICY "Users can view daily metrics for their projects" ON public.ads_daily_metrics FOR SELECT USING (public.user_has_project_access(auth.uid(), project_id));

-- Guest access policies
CREATE POLICY "Guests can view projects they have access to" ON public.projects FOR SELECT USING (
  id IN (SELECT project_id FROM public.guest_project_access WHERE user_id = auth.uid())
);
`;
}
