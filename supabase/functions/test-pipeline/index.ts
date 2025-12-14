/**
 * Test Pipeline Function
 * Standalone test to verify agents can be called
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

async function testPipeline() {
  // 1. Get monitoring profile
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profiles, error: profileError } = await supabase
    .from('monitoring_profiles')
    .select('*')
    .limit(1);

  if (profileError || !profiles || profiles.length === 0) {
    throw new Error(`No monitoring profiles found: ${profileError?.message}`);
  }

  const profile = profiles[0];

  // 2. Get prompt template
  const { data: prompts, error: promptError } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('id', profile.prompt_template_id)
    .single();

  if (promptError) {
    throw new Error(`Failed to get prompt template: ${promptError.message}`);
  }

  // 3. Create search_run
  const { data: run, error: runError } = await supabase
    .from('search_runs')
    .insert({
      type: 'test_pipeline',
      status: 'running',
      monitoring_profile_id: profile.id,
      created_by: null,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runError) {
    throw new Error(`Failed to create search_run: ${runError.message}`);
  }

  return {
    status: 'success',
    monitoring_profile_id: profile.id,
    search_run_id: run.id,
    prompt_template_id: profile.prompt_template_id,
    segment_ids: profile.segment_ids,
    geography_ids: profile.geography_ids,
  };
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const result = await testPipeline();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Test pipeline error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(handler);
