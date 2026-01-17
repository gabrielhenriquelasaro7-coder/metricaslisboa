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
  HardDrive,
  Image,
  FileCode2
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
  includeStorageFiles: boolean;
  includeSourceCode: boolean;
}

// Tables that contain heavy operational data (ads, metrics, creatives)
const HEAVY_DATA_TABLES = [
  'campaigns', 'ad_sets', 'ads', 'ads_daily_metrics',
  'google_campaigns', 'google_ad_groups', 'google_ads', 'google_ads_daily_metrics',
  'leads', 'leadgen_forms',
  'crm_deals', 'crm_sync_logs',
  'demographic_insights', 'dre_history',
  'optimization_history', 'period_metrics',
  'anomaly_alerts', 'ai_analysis_cache',
  'sync_logs', 'sync_progress',
];

// Tables that contain configuration/structure data (always exported)
const STRUCTURE_TABLES = [
  'projects', 'profiles', 'user_roles', 'user_management', 'squads', 'squad_members',
  'project_metric_config', 'project_import_months', 'project_investidores',
  'crm_connections', 'crm_pipelines',
  'account_goals', 'campaign_goals',
  'anomaly_alert_config', 'chart_preferences', 'user_hidden_metrics',
  'guest_invitations', 'guest_project_access',
  'suggestion_actions', 'investor_suggestions',
  'admin_access_requests', 'admin_access_grants',
  'whatsapp_instances', 'whatsapp_report_config',
  'system_settings',
];

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
  'export-database-schema', 'fetch-catalog-images', 'google-ads-sync', 
  'import-activity-history', 'import-historical-data', 'import-month-by-month', 
  'invite-guest', 'meta-ads-sync', 'meta-leads-sync', 'n8n-meta-sync', 
  'predictive-analysis', 'scheduled-sync-parallel', 'scheduled-sync', 
  'sync-ad-copies', 'sync-demographics', 'sync-webhook', 'whatsapp-balance-alert',
  'whatsapp-instance-manager', 'whatsapp-manager-instance', 'whatsapp-send',
  'whatsapp-webhook', 'whatsapp-weekly-report',
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

// Frontend source files structure
const FRONTEND_STRUCTURE = {
  components: [
    'admin', 'ai', 'alerts', 'auth', 'campaigns', 'catalog', 'dashboard',
    'filters', 'financial', 'guests', 'layout', 'leads', 'metrics',
    'optimization', 'pdf', 'predictive', 'projects', 'pwa', 'settings',
    'skeletons', 'sync', 'tour', 'ui', 'whatsapp'
  ],
  pages: [
    'AIAssistant', 'AdDetail', 'AdSetDetail', 'AdSets', 'Ads', 'Admin',
    'Auth', 'Campaigns', 'ChangePassword', 'CreativeDetail', 'Creatives',
    'Dashboard', 'Financial', 'GoogleCampaigns', 'GuestOnboarding', 'Index',
    'NotFound', 'Onboarding', 'OptimizationHistory', 'PredictiveAnalysis',
    'ProjectAdmin', 'ProjectDetail', 'ProjectSelector', 'ProjectSetup',
    'Settings', 'Suggestions', 'SyncHistory', 'WhatsApp', 'WhatsAppManager'
  ],
  hooks: [
    'useAIAssistant', 'useAccountGoals', 'useAdDailyMetrics', 'useAuth',
    'useCampaignGoals', 'useCRMConnection', 'useDailyMetrics', 'useProjects',
    'useProfile', 'useSyncWithProgress', 'useWhatsAppInstances', 'useUserRole'
  ]
};

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
    includeStorageFiles: true,
    includeSourceCode: true,
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

    const { data: policies, error } = await supabase.rpc('get_rls_policies' as any);
    
    if (error || !policies) {
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

    sql += getDatabaseFunctions();

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

  // Export storage files
  const exportStorageFiles = async (
    zip: JSZip, 
    onProgress: (bucket: string, file: string, current: number, total: number) => void
  ): Promise<{ totalFiles: number; totalSize: number }> => {
    let totalFiles = 0;
    let totalSize = 0;

    for (const bucket of STORAGE_BUCKETS) {
      try {
        // List all files in bucket
        const { data: files, error } = await supabase.storage
          .from(bucket.name)
          .list('', { limit: 1000 });

        if (error || !files) {
          console.log(`Error listing ${bucket.name}:`, error);
          continue;
        }

        // Handle nested folders
        const allFiles: string[] = [];
        
        const listRecursively = async (path: string) => {
          const { data, error } = await supabase.storage
            .from(bucket.name)
            .list(path, { limit: 1000 });
          
          if (error || !data) return;
          
          for (const item of data) {
            const fullPath = path ? `${path}/${item.name}` : item.name;
            if (item.id) {
              allFiles.push(fullPath);
            } else {
              // It's a folder
              await listRecursively(fullPath);
            }
          }
        };

        await listRecursively('');

        // Download each file
        for (let i = 0; i < allFiles.length; i++) {
          const filePath = allFiles[i];
          onProgress(bucket.name, filePath, i + 1, allFiles.length);

          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from(bucket.name)
              .download(filePath);

            if (downloadError || !fileData) {
              console.log(`Error downloading ${filePath}:`, downloadError);
              continue;
            }

            // Add to zip
            const arrayBuffer = await fileData.arrayBuffer();
            zip.file(`storage/${bucket.name}/${filePath}`, arrayBuffer);
            totalFiles++;
            totalSize += arrayBuffer.byteLength;
          } catch (err) {
            console.log(`Error processing file ${filePath}:`, err);
          }
        }
      } catch (err) {
        console.log(`Error processing bucket ${bucket.name}:`, err);
      }
    }

    return { totalFiles, totalSize };
  };

  // Generate frontend source code structure
  const generateSourceCodeManifest = (): string => {
    return `# V4 Company - Source Code Structure

## Project Overview

This is the complete source code structure for the V4 Company dashboard.

## Tech Stack
- React 18.3
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Supabase (Backend)
- React Query (Data Fetching)
- React Router (Routing)
- i18next (Internationalization)
- Recharts (Charts)
- Framer Motion (Animations)

## Directory Structure

\`\`\`
src/
├── components/           # Reusable UI components
${FRONTEND_STRUCTURE.components.map(c => `│   ├── ${c}/`).join('\n')}
├── pages/               # Route pages
${FRONTEND_STRUCTURE.pages.map(p => `│   ├── ${p}.tsx`).join('\n')}
├── hooks/               # Custom React hooks
${FRONTEND_STRUCTURE.hooks.map(h => `│   ├── ${h}.tsx`).join('\n')}
├── i18n/                # Internationalization
│   ├── index.ts
│   └── locales/
│       ├── pt-BR.json
│       ├── en-US.json
│       └── es.json
├── integrations/        # External integrations
│   └── supabase/
│       ├── client.ts
│       └── types.ts
├── lib/                 # Utilities
│   └── utils.ts
├── assets/              # Static assets
├── App.tsx              # Main app component
├── main.tsx             # Entry point
└── index.css            # Global styles

supabase/
├── config.toml          # Supabase configuration
└── functions/           # Edge Functions
${EDGE_FUNCTIONS.map(f => `    ├── ${f}/\n    │   └── index.ts`).join('\n')}
\`\`\`

## Installation

\`\`\`bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev

# Build for production
npm run build
\`\`\`

## Key Features

1. **Meta Ads Integration** - Sync and analyze Facebook/Instagram ads
2. **Google Ads Integration** - Sync and analyze Google Ads campaigns
3. **CRM Integration** - Connect with HubSpot, Pipedrive, RD Station
4. **WhatsApp Reports** - Automated reporting via WhatsApp
5. **AI Assistant** - AI-powered campaign analysis
6. **Predictive Analysis** - Forecast campaign performance
7. **Financial DRE** - Financial reporting and analysis
8. **Multi-language** - Portuguese, English, Spanish support

## Important Files

- \`src/App.tsx\` - Main routing and layout
- \`src/pages/Dashboard.tsx\` - Main dashboard view
- \`src/hooks/useAuth.tsx\` - Authentication logic
- \`src/hooks/useProjects.tsx\` - Projects management
- \`src/integrations/supabase/client.ts\` - Supabase client setup
`;
  };

  // Generate package.json template
  const generatePackageJson = (): string => {
    return JSON.stringify({
      name: "v4-company-dashboard",
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        lint: "eslint .",
      },
      dependencies: {
        "@hookform/resolvers": "^3.10.0",
        "@radix-ui/react-accordion": "^1.2.11",
        "@radix-ui/react-alert-dialog": "^1.1.14",
        "@radix-ui/react-checkbox": "^1.3.2",
        "@radix-ui/react-dialog": "^1.1.14",
        "@radix-ui/react-dropdown-menu": "^2.1.15",
        "@radix-ui/react-label": "^2.1.7",
        "@radix-ui/react-popover": "^1.1.14",
        "@radix-ui/react-progress": "^1.1.7",
        "@radix-ui/react-select": "^2.2.5",
        "@radix-ui/react-separator": "^1.1.7",
        "@radix-ui/react-slider": "^1.3.5",
        "@radix-ui/react-slot": "^1.2.3",
        "@radix-ui/react-switch": "^1.2.5",
        "@radix-ui/react-tabs": "^1.1.12",
        "@radix-ui/react-toast": "^1.2.14",
        "@radix-ui/react-tooltip": "^1.2.7",
        "@supabase/supabase-js": "^2.89.0",
        "@tanstack/react-query": "^5.83.0",
        "class-variance-authority": "^0.7.1",
        "clsx": "^2.1.1",
        "date-fns": "^3.6.0",
        "framer-motion": "^12.23.26",
        "i18next": "^25.7.4",
        "i18next-browser-languagedetector": "^8.2.0",
        "jspdf": "^4.0.0",
        "jszip": "^3.10.1",
        "lucide-react": "^0.462.0",
        react: "^18.3.1",
        "react-day-picker": "^8.10.1",
        "react-dom": "^18.3.1",
        "react-hook-form": "^7.61.1",
        "react-i18next": "^16.5.3",
        "react-router-dom": "^6.30.1",
        recharts: "^2.15.4",
        sonner: "^1.7.4",
        "tailwind-merge": "^2.6.0",
        "tailwindcss-animate": "^1.0.7",
        zod: "^3.25.76",
      },
      devDependencies: {
        "@types/node": "^22.14.0",
        "@types/react": "^18.3.18",
        "@types/react-dom": "^18.3.5",
        "@vitejs/plugin-react-swc": "^3.5.0",
        autoprefixer: "^10.4.21",
        eslint: "^9.21.0",
        postcss: "^8.5.3",
        tailwindcss: "^3.4.17",
        typescript: "^5.7.2",
        vite: "^6.2.0",
      },
    }, null, 2);
  };

  // Generate complete documentation
  const generateDocumentation = (dataStats: Record<string, number>, storageStats: { totalFiles: number; totalSize: number }): string => {
    const timestamp = new Date().toISOString();
    const totalRecords = Object.values(dataStats).reduce((sum, count) => sum + count, 0);
    
    return `# V4 Company - Complete Project Export

## 📋 Overview
This is a **COMPLETE** export of the V4 Company project, containing EVERYTHING needed to recreate the system from scratch.

**Generated at:** ${timestamp}
**Total Records:** ${totalRecords.toLocaleString()}
**Total Tables:** ${TABLES_TO_EXPORT.length}
**Storage Files:** ${storageStats.totalFiles} files (${(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB)

## 📁 Export Contents

\`\`\`
v4-company-full-export/
├── database/
│   ├── 01_schema.sql           # ENUMs, Tables, Constraints
│   ├── 02_functions.sql        # Database functions & triggers
│   ├── 03_rls_policies.sql     # Row Level Security policies
│   ├── 04_data.sql             # All data as INSERT statements
│   └── data.json               # All data in JSON format
├── storage/                    # ALL uploaded files
│   ├── project-avatars/        # Project avatar images
│   ├── creative-images/        # Creative/ad images
│   ├── creative-cache/         # Cached creative thumbnails
│   └── project-logos/          # Project logos
├── frontend/
│   ├── package.json            # Dependencies
│   ├── README.md               # Setup instructions
│   └── source-structure.md     # Code structure documentation
├── edge-functions/
│   └── README.md               # Edge functions list and deployment
├── secrets/
│   └── .env.example            # Required environment variables
└── docs/
    ├── README.md               # This file
    ├── restore-guide.md        # Step-by-step restore guide
    └── data-stats.json         # Export statistics
\`\`\`

## 🚀 How to Restore (Step-by-Step)

### Step 1: Get Source Code from Git
\`\`\`bash
git clone [YOUR_REPO_URL]
cd v4-company
\`\`\`

### Step 2: Create Supabase Project
1. Go to https://supabase.com
2. Create a new project
3. Wait for the project to be ready

### Step 3: Run Database Scripts (IN ORDER!)
\`\`\`bash
# Via SQL Editor in Supabase Dashboard, run in order:
# 1. database/01_schema.sql
# 2. database/02_functions.sql
# 3. database/03_rls_policies.sql
# 4. database/04_data.sql
\`\`\`

### Step 4: Configure Storage Buckets
Run \`storage/buckets.sql\` in the SQL Editor, then upload files from the \`storage/\` folder.

### Step 5: Deploy Edge Functions
\`\`\`bash
npm install -g supabase
supabase login
supabase link --project-ref [YOUR-PROJECT-REF]
supabase functions deploy --all
\`\`\`

### Step 6: Configure Secrets
Add all secrets from \`secrets/.env.example\` to Supabase Dashboard → Settings → Edge Functions → Secrets

### Step 7: Deploy Frontend
\`\`\`bash
cd frontend
npm install
# Create .env with your Supabase URL and key
npm run build
# Deploy to Vercel, Netlify, or your hosting
\`\`\`

## 📊 Data Statistics

| Table | Records |
|-------|---------|
${Object.entries(dataStats).map(([table, count]) => `| ${table} | ${count.toLocaleString()} |`).join('\n')}
| **TOTAL** | **${totalRecords.toLocaleString()}** |

## 📦 Storage Statistics

- **Total Files:** ${storageStats.totalFiles}
- **Total Size:** ${(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB

## 🔐 Required Secrets

${REQUIRED_SECRETS.map(s => `- \`${s.name}\`: ${s.description}`).join('\n')}

## ⚠️ Important Notes

1. **Order matters**: Run SQL files in numbered order (01, 02, 03, 04)
2. **Auth users**: User accounts need to be recreated via Supabase Auth
3. **Storage files**: Included in this export! Upload to corresponding buckets
4. **Secrets**: You need to reconfigure all API keys and tokens

---
*Generated by V4 Company Export System*
`;
  };

  // Generate restore guide
  const generateRestoreGuide = (): string => {
    return `# V4 Company - Complete Restore Guide

## Pre-requisites

- Node.js 18+
- npm or yarn
- Supabase CLI (for edge functions)
- Git (for source code)
- PostgreSQL client (psql) or Supabase SQL Editor

## Detailed Restoration Steps

### 1. Clone Source Code

First, get the source code from your Git repository:

\`\`\`bash
git clone [YOUR_REPO_URL]
cd v4-company
\`\`\`

If you don't have access to Git, you can use the frontend structure from this export to recreate the files.

### 2. Create New Supabase Project

1. Visit https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization
4. Set project name and database password
5. Select region closest to your users
6. Wait for project initialization (~2 minutes)

### 3. Apply Database Schema

In Supabase Dashboard → SQL Editor, run these files IN ORDER:

1. \`database/01_schema.sql\` - Creates types and tables
2. \`database/02_functions.sql\` - Creates database functions
3. \`database/03_rls_policies.sql\` - Creates security policies
4. \`database/04_data.sql\` - Imports all data

### 4. Configure Storage

Run in SQL Editor:
\`\`\`sql
INSERT INTO storage.buckets (id, name, public) VALUES ('project-avatars', 'project-avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('creative-images', 'creative-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('creative-cache', 'creative-cache', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('project-logos', 'project-logos', true);
\`\`\`

Then upload all files from the \`storage/\` folder to corresponding buckets via the Supabase Dashboard.

### 5. Deploy Edge Functions

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

### 6. Configure Secrets

In Supabase Dashboard → Settings → Edge Functions → Secrets, add:

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

### 7. Configure Frontend

1. Create \`.env\` file:
\`\`\`
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[YOUR-ANON-KEY]
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Build:
\`\`\`bash
npm run build
\`\`\`

4. Deploy to your hosting (Vercel, Netlify, etc.)

### 8. Recreate Users

User passwords are not included for security. Options:
1. Have users reset their passwords via "Forgot Password"
2. Use Supabase Dashboard → Authentication → Users to manually set passwords

### 9. Verify Installation

1. Access your deployed frontend
2. Login with a test account
3. Check if data loads correctly
4. Test sync functionality
5. Verify images load from storage

## Troubleshooting

### "relation does not exist"
- Run SQL files in order (01, 02, 03, 04)

### "permission denied"
- Check RLS policies were applied
- Verify user roles are correct

### Edge function errors
- Check all secrets are configured
- View function logs in Supabase Dashboard

### Images not loading
- Verify storage buckets exist
- Check files were uploaded to correct buckets
- Verify bucket is public

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
VITE_SUPABASE_PROJECT_ID=your-project-ref

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
    
    sql += `-- Storage RLS Policies
CREATE POLICY "Anyone can view public buckets" ON storage.objects FOR SELECT USING (bucket_id IN ('project-avatars', 'creative-images', 'creative-cache', 'project-logos'));
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
`;
    return sql;
  };

  // Main export handler
  const handleExport = async () => {
    setIsExporting(true);
    const dataStats: Record<string, number> = {};
    let storageStats = { totalFiles: 0, totalSize: 0 };
    
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
        const dataSql = await exportDataAsSQL((table, index) => {
          setProgress({ 
            phase: 'Data (SQL)', 
            current: index + 1, 
            total: TABLES_TO_EXPORT.length, 
            currentItem: table 
          });
        });
        zip.file('database/04_data.sql', dataSql);

        const dataJson = await exportDataAsJSON((table, index) => {
          setProgress({ 
            phase: 'Data (JSON)', 
            current: index + 1, 
            total: TABLES_TO_EXPORT.length, 
            currentItem: table 
          });
          dataStats[table] = 0;
        });
        
        for (const [table, data] of Object.entries(dataJson)) {
          dataStats[table] = data.length;
        }
        
        zip.file('database/data.json', JSON.stringify(dataJson, null, 2));
      }

      // Phase 5: Storage Files
      if (options.includeStorageFiles) {
        setProgress({ phase: 'Storage Files', current: 0, total: 100, currentItem: 'Downloading files...' });
        storageStats = await exportStorageFiles(zip, (bucket, file, current, total) => {
          setProgress({
            phase: 'Storage Files',
            current,
            total,
            currentItem: `${bucket}/${file}`
          });
        });
      }

      // Phase 6: Storage Config
      if (options.includeStorageInfo) {
        setProgress({ phase: 'Storage Config', current: 0, total: 1, currentItem: 'Generating storage config...' });
        zip.file('storage/buckets.sql', generateStorageSQL());
      }

      // Phase 7: Secrets
      setProgress({ phase: 'Secrets', current: 0, total: 1, currentItem: 'Generating env template...' });
      zip.file('secrets/.env.example', generateEnvExample());

      // Phase 8: Source Code Info
      if (options.includeSourceCode) {
        setProgress({ phase: 'Source Code', current: 0, total: 1, currentItem: 'Generating source structure...' });
        zip.file('frontend/README.md', generateSourceCodeManifest());
        zip.file('frontend/package.json', generatePackageJson());
        zip.file('frontend/source-structure.md', generateSourceCodeManifest());
        
        // Add important notes
        zip.file('frontend/IMPORTANT.md', `# CÓDIGO FONTE

O código fonte completo está disponível no repositório Git conectado ao projeto.

## Como obter o código fonte:

1. Acesse o Lovable.dev
2. Vá em Settings → GitHub
3. Clone o repositório

Ou use o botão "View Code" no Lovable para acessar diretamente.

## O que está nesta pasta:

- \`package.json\` - Lista completa de dependências
- \`README.md\` - Documentação e estrutura do projeto
- \`source-structure.md\` - Estrutura detalhada do código

## Estrutura do repositório Git:

\`\`\`
/
├── src/                    # Código fonte React
│   ├── components/         # Componentes reutilizáveis
│   ├── pages/              # Páginas da aplicação
│   ├── hooks/              # Custom hooks
│   ├── i18n/               # Traduções
│   └── integrations/       # Integrações (Supabase)
├── supabase/
│   ├── config.toml         # Configuração
│   └── functions/          # Edge Functions
├── public/                 # Assets públicos
└── package.json            # Dependências
\`\`\`
`);
      }

      // Phase 9: Edge Functions
      setProgress({ phase: 'Edge Functions', current: 0, total: 1, currentItem: 'Documenting functions...' });
      const functionsReadme = `# Edge Functions

The following ${EDGE_FUNCTIONS.length} edge functions are used in this project:

${EDGE_FUNCTIONS.map((f, i) => `${i + 1}. \`${f}\``).join('\n')}

## Deployment

\`\`\`bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy --all
\`\`\`

## Edge Function Code

The edge function source code is in the Git repository at:
\`supabase/functions/[function-name]/index.ts\`

Each function folder contains an \`index.ts\` file with the function logic.
`;
      zip.file('edge-functions/README.md', functionsReadme);

      // Phase 10: Documentation
      if (options.includeDocumentation) {
        setProgress({ phase: 'Documentation', current: 0, total: 1, currentItem: 'Generating docs...' });
        zip.file('docs/README.md', generateDocumentation(dataStats, storageStats));
        zip.file('docs/restore-guide.md', generateRestoreGuide());
        zip.file('docs/data-stats.json', JSON.stringify({ 
          tables: dataStats, 
          storage: storageStats,
          exportedAt: new Date().toISOString()
        }, null, 2));
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
      link.download = `v4-company-FULL-export-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalRecords = Object.values(dataStats).reduce((sum, count) => sum + count, 0);
      toast.success(`Exportação COMPLETA! ${totalRecords.toLocaleString()} registros + ${storageStats.totalFiles} arquivos.`);

    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Erro na exportação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  // Structure-only export handler (excludes heavy data tables)
  const handleStructureOnlyExport = async () => {
    setIsExporting(true);
    const dataStats: Record<string, number> = {};
    
    try {
      const zip = new JSZip();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      // Phase 1: Schema (always include)
      setProgress({ phase: 'Schema', current: 0, total: 1, currentItem: 'Generating database schema...' });
      const schema = await generateSchemaSQL();
      zip.file('database/01_schema.sql', schema);

      // Phase 2: Functions (always include)
      setProgress({ phase: 'Functions', current: 0, total: 1, currentItem: 'Generating database functions...' });
      const functions = generateFunctionsSQL();
      zip.file('database/02_functions.sql', functions);

      // Phase 3: RLS Policies (always include)
      setProgress({ phase: 'RLS Policies', current: 0, total: 1, currentItem: 'Generating security policies...' });
      const rlsPolicies = await generateRLSPoliciesSQL();
      zip.file('database/03_rls_policies.sql', rlsPolicies);

      // Phase 4: Structure data only (config tables, no heavy data)
      const structureDataSql = await exportStructureDataAsSQL((table, index) => {
        setProgress({ 
          phase: 'Data (Estrutura)', 
          current: index + 1, 
          total: STRUCTURE_TABLES.length, 
          currentItem: table 
        });
      });
      zip.file('database/04_structure_data.sql', structureDataSql);

      const structureDataJson = await exportStructureDataAsJSON((table, index) => {
        setProgress({ 
          phase: 'Data (JSON)', 
          current: index + 1, 
          total: STRUCTURE_TABLES.length, 
          currentItem: table 
        });
        dataStats[table] = 0;
      });
      
      for (const [table, data] of Object.entries(structureDataJson)) {
        dataStats[table] = data.length;
      }
      
      zip.file('database/structure_data.json', JSON.stringify(structureDataJson, null, 2));

      // Phase 5: Storage Config (no files)
      setProgress({ phase: 'Storage Config', current: 0, total: 1, currentItem: 'Generating storage config...' });
      zip.file('storage/buckets.sql', generateStorageSQL());

      // Phase 6: Secrets
      setProgress({ phase: 'Secrets', current: 0, total: 1, currentItem: 'Generating env template...' });
      zip.file('secrets/.env.example', generateEnvExample());

      // Phase 7: Source Code Info
      setProgress({ phase: 'Source Code', current: 0, total: 1, currentItem: 'Generating source structure...' });
      zip.file('frontend/README.md', generateSourceCodeManifest());
      zip.file('frontend/package.json', generatePackageJson());

      // Phase 8: Edge Functions
      setProgress({ phase: 'Edge Functions', current: 0, total: 1, currentItem: 'Documenting functions...' });
      const functionsReadme = `# Edge Functions\n\nThe following ${EDGE_FUNCTIONS.length} edge functions are used in this project:\n\n${EDGE_FUNCTIONS.map((f, i) => `${i + 1}. \`${f}\``).join('\n')}\n`;
      zip.file('edge-functions/README.md', functionsReadme);

      // Phase 9: Documentation
      setProgress({ phase: 'Documentation', current: 0, total: 1, currentItem: 'Generating docs...' });
      zip.file('docs/README.md', generateStructureOnlyDocumentation(dataStats));
      zip.file('docs/restore-guide.md', generateRestoreGuide());
      zip.file('docs/data-stats.json', JSON.stringify({ 
        exportType: 'structure-only',
        tables: dataStats, 
        excludedTables: HEAVY_DATA_TABLES,
        exportedAt: new Date().toISOString()
      }, null, 2));

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
      link.download = `v4-company-STRUCTURE-export-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalRecords = Object.values(dataStats).reduce((sum, count) => sum + count, 0);
      toast.success(`Exportação de ESTRUTURA concluída! ${totalRecords.toLocaleString()} registros de configuração.`);

    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Erro na exportação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  // Export structure data only (config tables)
  const exportStructureDataAsSQL = async (onProgress: (table: string, index: number) => void): Promise<string> => {
    let sql = '';
    const timestamp = new Date().toISOString();
    
    sql += `-- ============================================\n`;
    sql += `-- V4 Company - Structure Data Export\n`;
    sql += `-- (Configuration tables only, no ads/metrics data)\n`;
    sql += `-- Generated at: ${timestamp}\n`;
    sql += `-- ============================================\n\n`;

    sql += `-- IMPORTANT: Run schema.sql and functions.sql BEFORE running this file\n\n`;

    for (let i = 0; i < STRUCTURE_TABLES.length; i++) {
      const tableName = STRUCTURE_TABLES[i];
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

  // Export structure data as JSON
  const exportStructureDataAsJSON = async (onProgress: (table: string, index: number) => void): Promise<Record<string, any[]>> => {
    const exportData: Record<string, any[]> = {};

    for (let i = 0; i < STRUCTURE_TABLES.length; i++) {
      const tableName = STRUCTURE_TABLES[i];
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

  // Generate documentation for structure-only export
  const generateStructureOnlyDocumentation = (dataStats: Record<string, number>): string => {
    const timestamp = new Date().toISOString();
    const totalRecords = Object.values(dataStats).reduce((sum, count) => sum + count, 0);
    
    return `# V4 Company - Structure Export (Sem Dados de Ads)

## 📋 Overview
Este é um export de **ESTRUTURA** do projeto V4 Company, contendo configurações e estrutura, SEM dados operacionais.

**Generated at:** ${timestamp}
**Total Records:** ${totalRecords.toLocaleString()}
**Tables Included:** ${STRUCTURE_TABLES.length}
**Tables Excluded:** ${HEAVY_DATA_TABLES.length} (dados de ads, métricas, leads)

## ✅ Incluído neste export

- Schema completo (todas as tabelas)
- Funções e Triggers do banco
- Políticas RLS (segurança)
- Dados de configuração:
${STRUCTURE_TABLES.map(t => `  - ${t}`).join('\n')}

## ❌ NÃO Incluído (tabelas de dados pesados)

- ads, ad_sets, campaigns
- ads_daily_metrics, google_ads_daily_metrics
- leads, leadgen_forms
- demographic_insights
- optimization_history
- E outras tabelas de métricas...

## 📁 Export Contents

\`\`\`
v4-company-structure-export/
├── database/
│   ├── 01_schema.sql           # ENUMs, Tables, Constraints
│   ├── 02_functions.sql        # Database functions & triggers
│   ├── 03_rls_policies.sql     # Row Level Security policies
│   ├── 04_structure_data.sql   # Config data only
│   └── structure_data.json     # Config data in JSON
├── storage/
│   └── buckets.sql             # Storage buckets config
├── frontend/
│   ├── package.json
│   └── README.md
├── edge-functions/
│   └── README.md
├── secrets/
│   └── .env.example
└── docs/
    ├── README.md
    └── restore-guide.md
\`\`\`

## 📊 Data Statistics

| Table | Records |
|-------|---------|
${Object.entries(dataStats).map(([table, count]) => `| ${table} | ${count.toLocaleString()} |`).join('\n')}
| **TOTAL** | **${totalRecords.toLocaleString()}** |

---
*Generated by V4 Company Export System*
`;
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
          Exportação COMPLETA do Projeto
        </CardTitle>
        <CardDescription>
          Baixe ABSOLUTAMENTE TUDO: banco de dados, arquivos do storage, e documentação completa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Alert */}
        <Alert className="bg-green-500/10 border-green-500/30">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700 dark:text-green-400">Exportação Total Disponível!</AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-300">
            Este export inclui: banco de dados completo, todos os arquivos do storage (imagens, logos), 
            e documentação detalhada. O código fonte está no repositório Git.
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
              id="includeStorageFiles"
              checked={options.includeStorageFiles}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeStorageFiles: checked as boolean }))
              }
            />
            <Label htmlFor="includeStorageFiles" className="flex items-center gap-2">
              <Image className="h-4 w-4 text-pink-500" />
              Arquivos do Storage (Imagens)
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeSourceCode"
              checked={options.includeSourceCode}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, includeSourceCode: checked as boolean }))
              }
            />
            <Label htmlFor="includeSourceCode" className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-cyan-500" />
              Documentação do Código
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
              <HardDrive className="h-4 w-4 text-gray-500" />
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
              <p className="font-medium text-muted-foreground">📁 storage/</p>
              <ul className="text-muted-foreground space-y-0.5 ml-4">
                <li>• project-avatars/ - Avatares</li>
                <li>• creative-images/ - Criativos</li>
                <li>• creative-cache/ - Cache</li>
                <li>• project-logos/ - Logos</li>
                <li>• buckets.sql - Config</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">📁 frontend/</p>
              <ul className="text-muted-foreground space-y-0.5 ml-4">
                <li>• package.json - Dependências</li>
                <li>• README.md - Instruções</li>
                <li>• source-structure.md - Estrutura</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground">📁 outros/</p>
              <ul className="text-muted-foreground space-y-0.5 ml-4">
                <li>• secrets/.env.example</li>
                <li>• edge-functions/README.md</li>
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

        {/* Export Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Export Button */}
          <Button
            onClick={handleExport}
            disabled={isExporting || Object.values(options).every(v => !v)}
            className="w-full gap-2"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Exportar TUDO (.zip)
              </>
            )}
          </Button>

          {/* Structure Only Export Button */}
          <Button
            onClick={handleStructureOnlyExport}
            disabled={isExporting}
            variant="outline"
            className="w-full gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Database className="w-5 h-5" />
                Só Estrutura (Sem Dados de Ads)
              </>
            )}
          </Button>
        </div>

        {/* Info about structure-only export */}
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">Exportar Só Estrutura</AlertTitle>
          <AlertDescription className="text-xs text-amber-600 dark:text-amber-300">
            <p>O botão "Só Estrutura" exporta:</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>Schema completo (todas as tabelas)</li>
              <li>Funções e Triggers</li>
              <li>Políticas RLS</li>
              <li>Dados de configuração (projetos, usuários, squads, metas)</li>
              <li><strong>NÃO inclui:</strong> dados de ads, métricas diárias, leads, criativos</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Info about source code */}
        <Alert variant="default" className="bg-blue-500/10 border-blue-500/30">
          <FileCode className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-700 dark:text-blue-400">Código Fonte</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>O código fonte completo (React, TypeScript, Edge Functions) está disponível no <strong>repositório Git</strong> conectado ao projeto.</p>
            <p>Use o botão "View Code" no Lovable ou clone o repositório diretamente.</p>
          </AlertDescription>
        </Alert>

        {/* Info about what's NOT included */}
        <Alert variant="default" className="bg-muted/50">
          <Key className="h-4 w-4" />
          <AlertTitle>O que NÃO está incluído (por segurança)</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>• <strong>Senhas de usuários</strong> - Precisam ser redefinidas</p>
            <p>• <strong>Valores dos Secrets</strong> - Apenas template .env.example</p>
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

-- Add remaining tables...
-- (Google Ads, Leads, CRM, etc. - same pattern)
`;
}

// Database functions
function getDatabaseFunctions(): string {
  return `
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

-- Trigger Function: update_updated_at_column
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

-- Trigger Function: handle_new_user
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
`;
}

// Fallback RLS policies
function getRLSPoliciesFallback(): string {
  return `
-- ============================================
-- RLS Policies - Fallback
-- ============================================

-- Projects policies
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Tech and Gerente can view all projects" ON public.projects FOR SELECT USING (public.can_see_all_projects(auth.uid()));

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Tech can manage all roles" ON public.user_roles FOR ALL USING (public.has_cargo(auth.uid(), 'tech'));

-- Campaigns policies
CREATE POLICY "Users can view campaigns" ON public.campaigns FOR SELECT USING (public.user_has_project_access(auth.uid(), project_id));

-- Ad sets policies
CREATE POLICY "Users can view ad_sets" ON public.ad_sets FOR SELECT USING (public.user_has_project_access(auth.uid(), project_id));

-- Ads policies
CREATE POLICY "Users can view ads" ON public.ads FOR SELECT USING (public.user_has_project_access(auth.uid(), project_id));

-- Daily metrics policies
CREATE POLICY "Users can view daily metrics" ON public.ads_daily_metrics FOR SELECT USING (public.user_has_project_access(auth.uid(), project_id));
`;
}
