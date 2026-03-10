import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ToggleStatusRequest {
  userId: string;
  status: 'ativo' | 'inativo';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Validate JWT by fetching user with explicit token
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !caller) {
      console.error('Failed to validate token:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerId = caller.id;

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

    if (userId === callerId && status === 'inativo') {
      return new Response(
        JSON.stringify({ error: 'Você não pode desativar sua própria conta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating status for user ${userId} to ${status}`);

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

    if (status === 'inativo') {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h'
      });
      if (banError) console.warn('Failed to ban user:', banError);

      try {
        await supabaseAdmin.auth.admin.signOut(userId, 'global');
      } catch (signOutError) {
        console.warn('Failed to sign out user:', signOutError);
      }
    } else {
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none'
      });
      if (unbanError) console.warn('Failed to unban user:', unbanError);
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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
