import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLS() {
  const sql = `
    -- Fix RLS policies for reference tables
    DROP POLICY IF EXISTS "Event types viewable by authenticated" ON public.event_types;
    DROP POLICY IF EXISTS "Event types viewable by all" ON public.event_types;
    CREATE POLICY "Event types viewable by all"
      ON public.event_types FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "Segments viewable by authenticated users" ON public.segments;
    DROP POLICY IF EXISTS "Segments viewable by all" ON public.segments;
    CREATE POLICY "Segments viewable by all" ON public.segments
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Geographies viewable by authenticated users" ON public.geographies;
    DROP POLICY IF EXISTS "Geographies viewable by all" ON public.geographies;
    CREATE POLICY "Geographies viewable by all" ON public.geographies
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Prompt templates viewable by authenticated" ON public.prompt_templates;
    DROP POLICY IF EXISTS "Prompt templates viewable by all" ON public.prompt_templates;
    CREATE POLICY "Prompt templates viewable by all"
      ON public.prompt_templates FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "Monitoring profiles viewable by authenticated" ON public.monitoring_profiles;
    DROP POLICY IF EXISTS "Monitoring profiles viewable by all" ON public.monitoring_profiles;
    CREATE POLICY "Monitoring profiles viewable by all"
      ON public.monitoring_profiles FOR SELECT
      USING (true);
  `;

  const { error } = await supabase.rpc('exec', { sql });
  
  if (error) {
    console.error('Error fixing RLS:', error);
    throw error;
  }
  
  console.log('RLS policies fixed successfully');
}

Deno.serve(async (req) => {
  try {
    await fixRLS();
    return new Response(JSON.stringify({ status: 'success', message: 'RLS policies fixed' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
