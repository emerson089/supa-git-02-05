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

interface UpdateRoleRequest {
  userId: string;
  newRole: 'admin' | 'gerente' | 'vendedor' | 'vendedor_loja';
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
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Client with user token to verify identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate JWT using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
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
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem alterar roles.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId, newRole }: UpdateRoleRequest = await req.json();

    if (!userId || !newRole) {
      return new Response(
        JSON.stringify({ error: 'userId e newRole são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['admin', 'gerente', 'vendedor', 'vendedor_loja'].includes(newRole)) {
      return new Response(
        JSON.stringify({ error: 'Role inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent changing own role
    if (userId === callerId) {
      return new Response(
        JSON.stringify({ error: 'Você não pode alterar seu próprio role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating role for user ${userId} to ${newRole}`);

    // Check if user exists and get current role
    const { data: currentRole, error: checkError } = await supabaseAdmin
      .from('user_roles')
      .select('id, role')
      .eq('user_id', userId)
      .single();

    if (checkError || !currentRole) {
      console.error('User role not found:', checkError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update role
    const { error: updateError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update role:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalidate user's sessions to force re-login (they'll get new permissions)
    // This is done by signing out all sessions for the user
    try {
      await supabaseAdmin.auth.admin.signOut(userId, 'global');
      console.log(`Sessions invalidated for user ${userId}`);
    } catch (signOutError) {
      // Non-fatal, log and continue
      console.warn('Failed to invalidate sessions:', signOutError);
    }

    console.log(`Role updated successfully for user ${userId}: ${currentRole.role} -> ${newRole}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Role atualizado com sucesso. O usuário precisará fazer login novamente.',
        previousRole: currentRole.role,
        newRole
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