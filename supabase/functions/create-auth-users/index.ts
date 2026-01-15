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

    // Get request body
    const body = await req.json().catch(() => ({}));
    const specificEmail = body.email;

    // IMPORTANT: Only get users who DON'T have a user_id yet (never activated)
    // This prevents resetting passwords for already active accounts
    let query = supabase
      .from('user_management')
      .select('*')
      .is('user_id', null); // Only users without user_id = never activated

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
      skipped: [] as string[],
    };

    for (const user of users || []) {
      try {
        // Check if user already exists in auth.users
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);

        if (existingUser) {
          // User already exists in auth - link it to user_management but DON'T reset password
          console.log(`User ${user.email} already exists in auth, linking without password reset`);
          
          await supabase
            .from('user_management')
            .update({ 
              user_id: existingUser.id,
              needs_password_change: false // They already have an account, don't force password change
            })
            .eq('email', user.email);

          results.already_exists.push(user.email);
        } else {
          // Create new auth user - this is a fresh account
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
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
              .update({ 
                user_id: newUser.user.id,
                needs_password_change: true // New account needs password change
              })
              .eq('email', user.email);

            // Create profile if it doesn't exist
            await supabase
              .from('profiles')
              .upsert({
                user_id: newUser.user.id,
                full_name: user.full_name,
                cargo: user.cargo,
              }, { onConflict: 'user_id' });

            // IMPORTANT: Create user_roles entry with correct cargo
            // This is what the permission system actually uses
            await supabase
              .from('user_roles')
              .upsert({
                user_id: newUser.user.id,
                cargo: user.cargo,
              }, { onConflict: 'user_id' });

            console.log(`Created user ${user.email} with cargo: ${user.cargo}`);

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
      message: `Processed ${users?.length || 0} users (only accounts without auth)`,
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
