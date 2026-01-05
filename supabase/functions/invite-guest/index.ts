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

// Use Web Crypto API instead of bcrypt (compatible with Edge Runtime)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log('Creating supabase client...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requestingUser) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Requesting user:', requestingUser.id);

    const { guest_email, guest_name, project_id, resend } = await req.json();
    console.log('Request body:', { guest_email, guest_name, project_id, resend });

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
      .maybeSingle();

    console.log('Project lookup:', { project, projectError });

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'Project not found or not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tempPassword = generateTempPassword();
    let guestUserId: string;
    let isNewUser = false;

    // Check if user already exists by email
    const { data: existingUsersData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Failed to check existing users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingUser = existingUsersData?.users?.find(u => u.email?.toLowerCase() === guest_email.toLowerCase());

    if (existingUser) {
      console.log('User already exists:', existingUser.id);
      guestUserId = existingUser.id;
      
      // Check if this user already has access to THIS specific project
      const { data: existingAccess } = await supabase
        .from('guest_project_access')
        .select('id')
        .eq('user_id', guestUserId)
        .eq('project_id', project_id)
        .maybeSingle();
      
      // If user exists but is being invited to a NEW project, or if resending
      // Always generate new password so we can show it to the inviter
      const shouldGeneratePassword = resend || !existingAccess;
      
      if (shouldGeneratePassword) {
        const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(
          guestUserId,
          { password: tempPassword }
        );
        
        if (updatePasswordError) {
          console.error('Error updating password:', updatePasswordError);
        } else {
          isNewUser = true; // Set to true so we return the new password
          console.log('Password updated for', resend ? 'resend' : 'new project invitation');
        }
      }
      
      // Ensure role is set to convidado
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', guestUserId);
      
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: guestUserId, role: 'convidado' });

      if (roleError) {
        console.error('Error updating role:', roleError);
      }
    } else {
      console.log('Creating new user...');
      isNewUser = true;
      
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: guest_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: guest_name }
      });

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create user: ' + (createError?.message || 'Unknown error') }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      guestUserId = newUser.user.id;
      console.log('New user created:', guestUserId);

      // Wait a bit for the trigger to create the default role, then update it
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update role from gestor (default) to convidado
      const { error: roleUpdateError } = await supabase
        .from('user_roles')
        .update({ role: 'convidado' })
        .eq('user_id', guestUserId);

      if (roleUpdateError) {
        console.error('Error updating role:', roleUpdateError);
        // Try inserting instead
        await supabase
          .from('user_roles')
          .insert({ user_id: guestUserId, role: 'convidado' });
      }

      // Create profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          user_id: guestUserId, 
          full_name: guest_name 
        }, { onConflict: 'user_id' });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    }

    // Create or update invitation record
    console.log(resend ? 'Updating invitation record...' : 'Creating invitation record...');
    
    // Store a placeholder for the temp password (not the actual password for security)
    // The actual password is returned to the client once and never stored in plain text
    const storedPasswordValue = isNewUser ? '***GENERATED***' : '***REDACTED***';
    
    let invitation;
    let invitationError;
    
    if (resend) {
      // Update existing invitation with new hashed password
      const updateResult = await supabase
        .from('guest_invitations')
        .update({
          temp_password: storedPasswordValue,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('guest_email', guest_email)
        .eq('project_id', project_id)
        .select()
        .maybeSingle();
      
      invitation = updateResult.data;
      invitationError = updateResult.error;
    } else {
      // Create new invitation with hashed password
      const insertResult = await supabase
        .from('guest_invitations')
        .insert({
          invited_by: requestingUser.id,
          project_id: project_id,
          guest_email: guest_email,
          guest_name: guest_name,
          guest_user_id: guestUserId,
          temp_password: storedPasswordValue,
          status: 'pending'
        })
        .select()
        .single();
      
      invitation = insertResult.data;
      invitationError = insertResult.error;
    }

    if (invitationError) {
      console.error('Error with invitation:', invitationError);
      return new Response(JSON.stringify({ error: 'Failed to process invitation: ' + invitationError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Grant project access
    console.log('Granting project access...');
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

    console.log('Invitation created successfully');
    return new Response(JSON.stringify({
      success: true,
      invitation_id: invitation.id,
      temp_password: isNewUser ? tempPassword : null,
      is_new_user: isNewUser,
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
