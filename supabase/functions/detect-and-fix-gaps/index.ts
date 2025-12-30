import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

interface Gap {
  project_id: string;
  project_name: string;
  gap_start: string;
  gap_end: string;
  gap_days: number;
}

interface FixResult {
  project_name: string;
  gap_start: string;
  gap_end: string;
  fixed: boolean;
  records_imported: number;
  error?: string;
}

// Detect gaps in a project's data (minimum 3 consecutive days without data)
async function detectGaps(
  supabase: any,
  projectId: string,
  projectName: string,
  startDate: string,
  endDate: string
): Promise<Gap[]> {
  const gaps: Gap[] = [];
  
  // Get all dates that have data for this project
  const { data: datesWithData, error } = await supabase
    .from('ads_daily_metrics')
    .select('date')
    .eq('project_id', projectId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  
  if (error) {
    console.error(`[GAPS] Error fetching dates for ${projectName}:`, error);
    return gaps;
  }
  
  const dateSet = new Set(datesWithData?.map((d: any) => d.date) || []);
  
  // Iterate through expected date range
  let gapStart: Date | null = null;
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    const dateStr = formatDate(currentDate);
    
    if (!dateSet.has(dateStr)) {
      // Missing data for this date
      if (!gapStart) {
        gapStart = new Date(currentDate);
      }
    } else {
      // Has data - close any open gap
      if (gapStart) {
        const gapDays = Math.floor((currentDate.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24));
        
        // Only report gaps of 3+ days (small gaps are often just no spend days)
        if (gapDays >= 3) {
          gaps.push({
            project_id: projectId,
            project_name: projectName,
            gap_start: formatDate(gapStart),
            gap_end: formatDate(subDays(currentDate, 1)),
            gap_days: gapDays,
          });
        }
        gapStart = null;
      }
    }
    
    currentDate = addDays(currentDate, 1);
  }
  
  // Handle gap at the end of range
  if (gapStart) {
    const gapDays = Math.floor((end.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (gapDays >= 3) {
      gaps.push({
        project_id: projectId,
        project_name: projectName,
        gap_start: formatDate(gapStart),
        gap_end: endDate,
        gap_days: gapDays,
      });
    }
  }
  
  return gaps;
}

// Fix a gap by calling meta-ads-sync for that date range
async function fixGap(
  supabaseUrl: string,
  supabaseServiceKey: string,
  gap: Gap,
  adAccountId: string
): Promise<FixResult> {
  console.log(`[FIX] ${gap.project_name}: ${gap.gap_start} to ${gap.gap_end} (${gap.gap_days} days)`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/meta-ads-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        project_id: gap.project_id,
        ad_account_id: adAccountId,
        time_range: { since: gap.gap_start, until: gap.gap_end },
        period_key: `gap_fix_${gap.gap_start}_${gap.gap_end}`,
      }),
    });
    
    const data = await response.json().catch(() => ({ success: false }));
    
    if (data.success) {
      const records = data.data?.daily_records_count || 0;
      console.log(`[FIX] ✓ ${gap.project_name}: ${records} records imported`);
      return {
        project_name: gap.project_name,
        gap_start: gap.gap_start,
        gap_end: gap.gap_end,
        fixed: true,
        records_imported: records,
      };
    } else {
      // Zero records is OK - means no campaigns were active in that period
      if (data.data?.daily_records_count === 0) {
        console.log(`[FIX] ✓ ${gap.project_name}: No active campaigns in this period`);
        return {
          project_name: gap.project_name,
          gap_start: gap.gap_start,
          gap_end: gap.gap_end,
          fixed: true,
          records_imported: 0,
        };
      }
      
      return {
        project_name: gap.project_name,
        gap_start: gap.gap_start,
        gap_end: gap.gap_end,
        fixed: false,
        records_imported: 0,
        error: data.error || 'Unknown error',
      };
    }
  } catch (error) {
    return {
      project_name: gap.project_name,
      gap_start: gap.gap_start,
      gap_end: gap.gap_end,
      fixed: false,
      records_imported: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let requestBody: { project_id?: string; since?: string; until?: string; auto_fix?: boolean } = {};
    try {
      requestBody = await req.json();
    } catch {
      // Use defaults
    }

    const { project_id, auto_fix = true } = requestBody;
    
    // Default: check from January 1st of current year to today
    const now = new Date();
    const since = requestBody.since || `${now.getFullYear()}-01-01`;
    const until = requestBody.until || formatDate(now);

    console.log(`\n========== GAP DETECTION STARTED ==========`);
    console.log(`[GAPS] Range: ${since} to ${until}`);
    console.log(`[GAPS] Auto-fix: ${auto_fix}`);

    // Fetch projects
    let projectsQuery = supabase
      .from('projects')
      .select('id, ad_account_id, name')
      .eq('archived', false)
      .not('ad_account_id', 'is', null);

    if (project_id) {
      projectsQuery = projectsQuery.eq('id', project_id);
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError || !projects || projects.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No projects found', gaps: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[GAPS] Checking ${projects.length} projects...`);

    // Detect gaps for all projects
    const allGaps: Gap[] = [];
    for (const project of projects) {
      const projectGaps = await detectGaps(supabase, project.id, project.name, since, until);
      allGaps.push(...projectGaps);
      
      if (projectGaps.length > 0) {
        console.log(`[GAPS] ${project.name}: ${projectGaps.length} gaps found`);
        projectGaps.forEach(g => console.log(`  - ${g.gap_start} to ${g.gap_end} (${g.gap_days} days)`));
      } else {
        console.log(`[GAPS] ${project.name}: ✓ No gaps`);
      }
    }

    // Fix gaps if auto_fix is enabled
    const fixResults: FixResult[] = [];
    if (auto_fix && allGaps.length > 0) {
      console.log(`\n========== FIXING ${allGaps.length} GAPS ==========`);
      
      const DELAY_BETWEEN_FIXES = 10000; // 10 seconds between fixes
      const RETRY_DELAY = 60000; // 60 seconds on rate limit
      const MAX_FIX_RETRIES = 3;
      
      for (let gapIdx = 0; gapIdx < allGaps.length; gapIdx++) {
        const gap = allGaps[gapIdx];
        const project = projects.find(p => p.id === gap.project_id);
        if (!project) continue;
        
        let retryCount = 0;
        let fixSuccess = false;
        
        while (retryCount < MAX_FIX_RETRIES && !fixSuccess) {
          const result = await fixGap(supabaseUrl, supabaseServiceKey, gap, project.ad_account_id);
          
          // Check if rate limit error
          const isRateLimit = result.error?.includes('rate') || result.error?.includes('limit') || result.error?.includes('429');
          
          if (!result.fixed && isRateLimit && retryCount < MAX_FIX_RETRIES - 1) {
            retryCount++;
            console.log(`[FIX] ⏳ Rate limit on gap ${gapIdx + 1}, waiting ${RETRY_DELAY / 1000}s before retry ${retryCount}/${MAX_FIX_RETRIES}...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          } else {
            fixResults.push(result);
            fixSuccess = true;
          }
        }
        
        // Delay between fixes (except last)
        if (gapIdx < allGaps.length - 1) {
          console.log(`[FIX] Waiting ${DELAY_BETWEEN_FIXES / 1000}s before next gap...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_FIXES));
        }
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const fixedCount = fixResults.filter(r => r.fixed).length;
    const totalRecordsImported = fixResults.reduce((sum, r) => sum + r.records_imported, 0);

    console.log(`\n========== GAP DETECTION COMPLETE ==========`);
    console.log(`[GAPS] Time: ${elapsed.toFixed(1)}s`);
    console.log(`[GAPS] Total gaps found: ${allGaps.length}`);
    console.log(`[GAPS] Gaps fixed: ${fixedCount}/${allGaps.length}`);
    console.log(`[GAPS] Records imported: ${totalRecordsImported}`);

    // Log to sync_logs
    for (const project of projects) {
      const projectGaps = allGaps.filter(g => g.project_id === project.id);
      const projectFixes = fixResults.filter(r => r.project_name === project.name);
      
      if (projectGaps.length > 0) {
        await supabase.from('sync_logs').insert({
          project_id: project.id,
          status: projectFixes.every(f => f.fixed) ? 'success' : 'partial',
          message: JSON.stringify({
            type: 'gap_detection',
            gaps_found: projectGaps.length,
            gaps_fixed: projectFixes.filter(f => f.fixed).length,
            records_imported: projectFixes.reduce((sum, f) => sum + f.records_imported, 0),
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        elapsed_seconds: elapsed,
        gaps_found: allGaps.length,
        gaps_fixed: fixedCount,
        records_imported: totalRecordsImported,
        gaps: allGaps,
        fix_results: fixResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GAP ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
