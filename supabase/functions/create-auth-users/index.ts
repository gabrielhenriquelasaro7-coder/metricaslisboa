import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a random password
function generateRandomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

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
    const { email, full_name, phone, cargo, squad_id, createSingle } = body;

    // Mode 1: Create a single user with all data (new flow)
    if (createSingle && email) {
      // Check if user already exists in user_management
      const { data: existingMgmt } = await supabase
        .from('user_management')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingMgmt) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Usuário com este email já existe' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user already exists in auth.users
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingAuth = existingUsers?.users?.find(u => u.email === email);

      if (existingAuth) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Usuário já existe no sistema de autenticação' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate random password
      const password = generateRandomPassword(10);

      // Create auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError || !newUser.user) {
        console.error('Error creating auth user:', createError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: createError?.message || 'Erro ao criar usuário' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userId = newUser.user.id;

      // Create user_management entry
      await supabase
        .from('user_management')
        .insert({
          user_id: userId,
          email,
          full_name: full_name || null,
          phone: phone || null,
          cargo: cargo || 'membro',
          squad_id: squad_id || null,
          needs_password_change: true,
        });

      // Create profile
      await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          full_name: full_name || null,
          cargo: cargo || 'membro',
        }, { onConflict: 'user_id' });

      // Create user_roles entry
      await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          cargo: cargo || 'membro',
        }, { onConflict: 'user_id' });

      // Add to squad_members if squad_id provided
      if (squad_id) {
        await supabase
          .from('squad_members')
          .insert({ user_id: userId, squad_id });
      }

      console.log(`Created user ${email} with cargo: ${cargo}`);

      return new Response(JSON.stringify({
        success: true,
        user_id: userId,
        email,
        password, // Return password so admin can share it
        message: 'Usuário criado com sucesso',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode 2: Batch activate users without auth (old flow for compatibility)
    const specificEmail = body.email;

    let query = supabase
      .from('user_management')
      .select('*')
      .is('user_id', null);

    if (specificEmail && !createSingle) {
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
      created: [] as { email: string; password: string }[],
      already_exists: [] as string[],
      failed: [] as { email: string; error: string }[],
      skipped: [] as string[],
    };

    for (const user of users || []) {
      try {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === user.email);

        if (existingUser) {
          await supabase
            .from('user_management')
            .update({ 
              user_id: existingUser.id,
              needs_password_change: false
            })
            .eq('email', user.email);

          results.already_exists.push(user.email);
        } else {
          const password = generateRandomPassword(10);
          
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: user.email,
            password,
            email_confirm: true,
            user_metadata: { full_name: user.full_name },
          });

          if (createError) {
            console.error(`Error creating user ${user.email}:`, createError);
            results.failed.push({ email: user.email, error: createError.message });
          } else if (newUser.user) {
            await supabase
              .from('user_management')
              .update({ 
                user_id: newUser.user.id,
                needs_password_change: true
              })
              .eq('email', user.email);

            await supabase
              .from('profiles')
              .upsert({
                user_id: newUser.user.id,
                full_name: user.full_name,
                cargo: user.cargo,
              }, { onConflict: 'user_id' });

            await supabase
              .from('user_roles')
              .upsert({
                user_id: newUser.user.id,
                cargo: user.cargo,
              }, { onConflict: 'user_id' });

            console.log(`Created user ${user.email} with cargo: ${user.cargo}`);

            results.created.push({ email: user.email, password });
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
