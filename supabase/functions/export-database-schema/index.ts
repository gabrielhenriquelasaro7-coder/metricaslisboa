import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// All tables in the database
const ALL_TABLES = [
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // --- AUTH CHECK: require valid JWT and tech role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // Check tech role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleCheck } = await supabase.rpc("has_cargo", {
      _user_id: userId,
      _cargo: "tech",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: tech role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- END AUTH CHECK ---

    const { exportType = 'full', includeData = true, tables = ALL_TABLES } = await req.json();

    let sqlOutput = '';
    const timestamp = new Date().toISOString();
    
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
        const { data: columns, error: colError } = await supabase
          .from('information_schema.columns' as any)
          .select('column_name, data_type, is_nullable, column_default, character_maximum_length, udt_name')
          .eq('table_schema', 'public')
          .eq('table_name', tableName);

        if (colError || !columns || columns.length === 0) {
          continue;
        }

        sqlOutput += `-- ============================================\n`;
        sqlOutput += `-- TABLE: ${tableName}\n`;
        sqlOutput += `-- ============================================\n\n`;

        sqlOutput += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
        
        const columnDefs: string[] = [];
        for (const col of columns as any[]) {
          let colDef = `  ${col.column_name} `;
          
          if (col.data_type === 'ARRAY') {
            colDef += `${col.udt_name.replace('_', '')}[]`;
          } else if (col.data_type === 'USER-DEFINED') {
            colDef += col.udt_name;
          } else if (col.character_maximum_length) {
            colDef += `${col.data_type}(${col.character_maximum_length})`;
          } else {
            colDef += col.data_type;
          }
          
          if (col.is_nullable === 'NO') {
            colDef += ' NOT NULL';
          }
          
          if (col.column_default) {
            colDef += ` DEFAULT ${col.column_default}`;
          }
          
          columnDefs.push(colDef);
        }
        
        sqlOutput += columnDefs.join(',\n');
        sqlOutput += `\n);\n\n`;

        const hasIdColumn = (columns as any[]).some(c => c.column_name === 'id');
        if (hasIdColumn) {
          sqlOutput += `ALTER TABLE public.${tableName} ADD CONSTRAINT ${tableName}_pkey PRIMARY KEY (id);\n\n`;
        }

        sqlOutput += `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;\n\n`;

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

    sqlOutput += `-- ============================================\n`;
    sqlOutput += `-- DATABASE FUNCTIONS\n`;
    sqlOutput += `-- ============================================\n\n`;

    const functions = [
      'has_role', 'handle_new_user_role', 'user_has_project_access',
      'get_user_cargo', 'has_cargo', 'needs_password_change',
      'can_see_all_projects', 'get_user_squad_ids', 'has_admin_access',
      'has_project_admin_access', 'can_view_project', 'is_master_user',
      'update_updated_at_column', 'handle_new_user',
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
        error: "An internal error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
