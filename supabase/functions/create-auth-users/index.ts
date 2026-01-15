import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_PASSWORD = '12345678';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user is authenticated and has permission
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get request body (optional - can specify specific email)
    const body = await req.json().catch(() => ({}));
    const specificEmail = body.email;

    // Get users from user_management who need auth accounts
    let query = supabase
      .from('user_management')
      .select('*')
      .eq('needs_password_change', true);

    if (specificEmail) {
      query = query.eq('email', specificEmail);
    }

    const { data: users, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = {
      created: [] as string[],
      already_exists: [] as string[],
      failed: [] as { email: string; error: string }[],
      password_reset: [] as string[],
    };

    for (const user of users || []) {
      try {
        // Check if user already exists in auth
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);

        if (existingUser) {
          // User exists - update their password to the default
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: DEFAULT_PASSWORD }
          );

          if (updateError) {
            console.error(`Error resetting password for ${user.email}:`, updateError);
            results.failed.push({ email: user.email, error: updateError.message });
          } else {
            // Update user_management with correct user_id
            await supabase
              .from('user_management')
              .update({ user_id: existingUser.id })
              .eq('email', user.email);

            results.password_reset.push(user.email);
          }
        } else {
          // Create new auth user
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: DEFAULT_PASSWORD,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              full_name: user.full_name,
            },
          });

          if (createError) {
            console.error(`Error creating user ${user.email}:`, createError);
            results.failed.push({ email: user.email, error: createError.message });
          } else if (newUser.user) {
            // Update user_management with the new auth user_id
            await supabase
              .from('user_management')
              .update({ user_id: newUser.user.id })
              .eq('email', user.email);

            // Create profile if it doesn't exist
            await supabase
              .from('profiles')
              .upsert({
                user_id: newUser.user.id,
                full_name: user.full_name,
                cargo: user.cargo,
              }, { onConflict: 'user_id' });

            results.created.push(user.email);
          }
        }
      } catch (err) {
        console.error(`Error processing user ${user.email}:`, err);
        results.failed.push({ email: user.email, error: String(err) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${users?.length || 0} users`,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-auth-users:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
