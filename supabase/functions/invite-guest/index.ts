import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
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

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { guest_email, guest_name, project_id } = await req.json();

    if (!guest_email || !guest_name || !project_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the project belongs to the requesting user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', project_id)
      .eq('user_id', requestingUser.id)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'Project not found or not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === guest_email);

    let guestUserId: string;
    const tempPassword = generateTempPassword();

    if (existingUser) {
      guestUserId = existingUser.id;
      
      // Update role to convidado if not already
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: guestUserId, 
          role: 'convidado' 
        }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.error('Error updating role:', roleError);
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: guest_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: guest_name }
      });

      if (createError || !newUser.user) {
        return new Response(JSON.stringify({ error: 'Failed to create user: ' + createError?.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      guestUserId = newUser.user.id;

      // Set role to convidado
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: guestUserId, role: 'convidado' });

      if (roleError) {
        console.error('Error inserting role:', roleError);
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ user_id: guestUserId, full_name: guest_name });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    }

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from('guest_invitations')
      .insert({
        invited_by: requestingUser.id,
        project_id: project_id,
        guest_email: guest_email,
        guest_name: guest_name,
        guest_user_id: guestUserId,
        temp_password: tempPassword,
        status: 'pending'
      })
      .select()
      .single();

    if (invitationError) {
      return new Response(JSON.stringify({ error: 'Failed to create invitation: ' + invitationError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Grant project access
    const { error: accessError } = await supabase
      .from('guest_project_access')
      .upsert({
        user_id: guestUserId,
        project_id: project_id,
        granted_by: requestingUser.id
      }, { onConflict: 'user_id,project_id' });

    if (accessError) {
      console.error('Error granting access:', accessError);
    }

    return new Response(JSON.stringify({
      success: true,
      invitation_id: invitation.id,
      temp_password: tempPassword,
      guest_email: guest_email,
      project_name: project.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in invite-guest function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
