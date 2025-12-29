// Simple debug function to check environment variables

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  console.log('🔍 Debug-env function started');

  const envCheck = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') || 'MISSING',
    SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ? 'EXISTS' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'EXISTS' : 'MISSING',
    OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY') ? 'EXISTS' : 'MISSING',
    PERPLEXITY_API_KEY: Deno.env.get('PERPLEXITY_API_KEY') ? 'EXISTS' : 'MISSING',
  };

  console.log('Environment variables:', envCheck);

  return new Response(
    JSON.stringify({
      message: 'Debug info',
      env: envCheck,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
