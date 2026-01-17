import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All tables in the database
const ALL_TABLES = [
  // Core
  'projects',
  'profiles',
  'user_roles',
  'user_management',
  'squads',
  'squad_members',
  
  // Project Config
  'project_metric_config',
  'project_import_months',
  'project_investidores',
  
  // Meta Ads
  'campaigns',
  'ad_sets',
  'ads',
  'ads_daily_metrics',
  
  // Google Ads
  'google_campaigns',
  'google_ad_groups',
  'google_ads',
  'google_ads_daily_metrics',
  
  // Leads
  'leads',
  'leadgen_forms',
  
  // CRM
  'crm_connections',
  'crm_pipelines',
  'crm_deals',
  'crm_sync_logs',
  
  // Goals
  'account_goals',
  'campaign_goals',
  
  // Insights
  'demographic_insights',
  
  // Financial
  'dre_history',
  
  // History
  'optimization_history',
  'period_metrics',
  
  // Alerts
  'anomaly_alerts',
  'anomaly_alert_config',
  
  // AI
  'ai_analysis_cache',
  
  // Preferences
  'chart_preferences',
  'user_hidden_metrics',
  
  // Guests
  'guest_invitations',
  'guest_project_access',
  
  // Suggestions
  'suggestion_actions',
  'investor_suggestions',
  
  // Admin
  'admin_access_requests',
  'admin_access_grants',
  
  // WhatsApp
  'whatsapp_instances',
  'whatsapp_report_config',
  
  // Sync
  'sync_logs',
  'sync_progress',
  
  // System
  'system_settings',
];

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface TableConstraint {
  constraint_name: string;
  constraint_type: string;
  column_name: string;
  foreign_table_name?: string;
  foreign_column_name?: string;
}

interface TableIndex {
  indexname: string;
  indexdef: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { exportType = 'full', includeData = true, tables = ALL_TABLES } = await req.json();

    let sqlOutput = '';
    const timestamp = new Date().toISOString();
    
    // Header
    sqlOutput += `-- ============================================\n`;
    sqlOutput += `-- V4 Company - Database Export\n`;
    sqlOutput += `-- Generated at: ${timestamp}\n`;
    sqlOutput += `-- Export Type: ${exportType}\n`;
    sqlOutput += `-- Include Data: ${includeData}\n`;
    sqlOutput += `-- ============================================\n\n`;

    // Get all enums
    const { data: enums, error: enumError } = await supabase.rpc('get_enums');
    
    if (!enumError && enums) {
      sqlOutput += `-- ============================================\n`;
      sqlOutput += `-- ENUMS\n`;
      sqlOutput += `-- ============================================\n\n`;
      
      for (const enumDef of enums) {
        sqlOutput += `CREATE TYPE ${enumDef.enum_name} AS ENUM (\n`;
        sqlOutput += enumDef.enum_values.map((v: string) => `  '${v}'`).join(',\n');
        sqlOutput += `\n);\n\n`;
      }
    }

    // Process each table
    for (const tableName of tables) {
      try {
        // Get table structure
        const { data: columns, error: colError } = await supabase
          .from('information_schema.columns' as any)
          .select('column_name, data_type, is_nullable, column_default, character_maximum_length, udt_name')
          .eq('table_schema', 'public')
          .eq('table_name', tableName);

        if (colError || !columns || columns.length === 0) {
          // Table might not exist or no access, skip
          continue;
        }

        sqlOutput += `-- ============================================\n`;
        sqlOutput += `-- TABLE: ${tableName}\n`;
        sqlOutput += `-- ============================================\n\n`;

        // Build CREATE TABLE statement
        sqlOutput += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
        
        const columnDefs: string[] = [];
        for (const col of columns as any[]) {
          let colDef = `  ${col.column_name} `;
          
          // Handle data type
          if (col.data_type === 'ARRAY') {
            colDef += `${col.udt_name.replace('_', '')}[]`;
          } else if (col.data_type === 'USER-DEFINED') {
            colDef += col.udt_name;
          } else if (col.character_maximum_length) {
            colDef += `${col.data_type}(${col.character_maximum_length})`;
          } else {
            colDef += col.data_type;
          }
          
          // Nullable
          if (col.is_nullable === 'NO') {
            colDef += ' NOT NULL';
          }
          
          // Default value
          if (col.column_default) {
            colDef += ` DEFAULT ${col.column_default}`;
          }
          
          columnDefs.push(colDef);
        }
        
        sqlOutput += columnDefs.join(',\n');
        sqlOutput += `\n);\n\n`;

        // Get constraints (simplified approach)
        // Primary Key - assume 'id' column for most tables
        const hasIdColumn = (columns as any[]).some(c => c.column_name === 'id');
        if (hasIdColumn) {
          sqlOutput += `-- Primary Key\n`;
          sqlOutput += `ALTER TABLE public.${tableName} ADD CONSTRAINT ${tableName}_pkey PRIMARY KEY (id);\n\n`;
        }

        // Enable RLS
        sqlOutput += `-- Enable RLS\n`;
        sqlOutput += `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;\n\n`;

        // Export data if requested
        if (includeData) {
          const { data: tableData, error: dataError } = await supabase
            .from(tableName as any)
            .select('*')
            .limit(10000);

          if (!dataError && tableData && tableData.length > 0) {
            sqlOutput += `-- Data for ${tableName} (${tableData.length} rows)\n`;
            
            const columnNames = Object.keys(tableData[0]);
            
            for (const row of tableData) {
              const values = columnNames.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                if (typeof val === 'number') return val.toString();
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
                return `'${String(val).replace(/'/g, "''")}'`;
              });
              
              sqlOutput += `INSERT INTO public.${tableName} (${columnNames.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
            }
            sqlOutput += '\n';
          }
        }

      } catch (tableError) {
        sqlOutput += `-- Error processing table ${tableName}: ${tableError}\n\n`;
      }
    }

    // Add database functions
    sqlOutput += `-- ============================================\n`;
    sqlOutput += `-- DATABASE FUNCTIONS\n`;
    sqlOutput += `-- ============================================\n\n`;

    const functions = [
      'has_role',
      'handle_new_user_role',
      'user_has_project_access',
      'get_user_cargo',
      'has_cargo',
      'needs_password_change',
      'can_see_all_projects',
      'get_user_squad_ids',
      'has_admin_access',
      'has_project_admin_access',
      'can_view_project',
      'is_master_user',
      'update_updated_at_column',
      'handle_new_user',
    ];

    for (const funcName of functions) {
      sqlOutput += `-- Function: ${funcName}\n`;
      sqlOutput += `-- (See supabase/migrations for full function definition)\n\n`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        sql: sqlOutput,
        tables: tables.length,
        timestamp,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    console.error("Export error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
