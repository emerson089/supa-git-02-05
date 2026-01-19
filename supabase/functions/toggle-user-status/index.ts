import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://denim-flow-master.lovable.app',
  'https://id-preview--daf59025-1007-41d6-9df6-d2c77da6cb3c.lovable.app',
  'https://daf59025-1007-41d6-9df6-d2c77da6cb3c.lovableproject.com',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

interface ToggleStatusRequest {
  userId: string;
  status: 'ativo' | 'inativo';
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Validate JWT using getClaims
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Failed to validate token:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if caller is admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: callerId,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      console.error('User is not admin:', callerId);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem alterar status.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, status }: ToggleStatusRequest = await req.json();

    if (!userId || !status) {
      return new Response(
        JSON.stringify({ error: 'userId e status são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['ativo', 'inativo'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Status inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent deactivating own account
    if (userId === callerId && status === 'inativo') {
      return new Response(
        JSON.stringify({ error: 'Você não pode desativar sua própria conta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating status for user ${userId} to ${status}`);

    // Update status in profiles
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If deactivating, also ban the user from Supabase Auth
    if (status === 'inativo') {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h' // ~100 years
      });

      if (banError) {
        console.warn('Failed to ban user:', banError);
        // Continue anyway, they're marked as inactive
      }

      // Sign out all sessions
      try {
        await supabaseAdmin.auth.admin.signOut(userId, 'global');
      } catch (signOutError) {
        console.warn('Failed to sign out user:', signOutError);
      }
    } else {
      // If reactivating, unban the user
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none'
      });

      if (unbanError) {
        console.warn('Failed to unban user:', unbanError);
      }
    }

    console.log(`Status updated successfully for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: status === 'ativo' ? 'Usuário ativado com sucesso' : 'Usuário desativado com sucesso',
        status
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});