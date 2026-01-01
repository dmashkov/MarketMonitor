// Job Processor - Async queue worker for processing pipeline jobs
// Architecture: pg_cron triggers this function every minute
// Function picks pending jobs and processes them segment-by-segment

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PipelineJob {
  id: string;
  monitoring_profile_id: string;
  status: string;
  total_segments: number;
  processed_segments: number;
  total_sources: number;
  current_segment_id: string | null;
  documents_created: number;
  errors: Array<{ segment_id: string; error: string }>;
  created_by: string;
  metadata: Record<string, any>;
}

interface MonitoringProfile {
  id: string;
  name: string;
  prompt_template_id: string;
  segment_ids: string[] | null;
  geography_ids: string[] | null;
  min_source_priority: number;
  max_sources_per_run: number;
}

interface PromptTemplate {
  id: string;
  name: string;
  template_text: string;
  stage: string;
}

interface Segment {
  id: string;
  name: string;
  code: string;
}

interface SourceHunterResult {
  status: string;
  documents_created: number;
  segment_links: number;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log('🔄 Job Processor started');

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===========================================
    // STEP 1: Pick next pending job (FIFO)
    // ===========================================

    const { data: pendingJobs, error: fetchError } = await supabase
      .from('pipeline_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error('❌ Error fetching pending jobs:', fetchError);
      throw fetchError;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('✅ No pending jobs in queue');
      return new Response(
        JSON.stringify({ message: 'No pending jobs', jobs_processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const job: PipelineJob = pendingJobs[0];
    console.log(`📋 Processing job ${job.id} (profile: ${job.monitoring_profile_id})`);

    // ===========================================
    // STEP 2: Mark job as in_progress
    // ===========================================

    const { error: updateError } = await supabase
      .from('pipeline_jobs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (updateError) {
      console.error('❌ Error updating job status:', updateError);
      throw updateError;
    }

    // ===========================================
    // STEP 3: Load monitoring profile
    // ===========================================

    const { data: profile, error: profileError } = await supabase
      .from('monitoring_profiles')
      .select('*')
      .eq('id', job.monitoring_profile_id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Error loading monitoring profile:', profileError);
      await markJobFailed(supabase, job.id, `Profile not found: ${profileError?.message}`);
      throw new Error(`Profile not found: ${profileError?.message}`);
    }

    console.log(`✅ Loaded profile: ${profile.name}`);

    // ===========================================
    // STEP 4: Load prompt template
    // ===========================================

    if (!profile.prompt_template_id) {
      console.error('❌ Profile has no prompt_template_id');
      await markJobFailed(supabase, job.id, 'Profile has no prompt template configured');
      throw new Error('Profile has no prompt template configured');
    }

    const { data: promptTemplate, error: templateError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', profile.prompt_template_id)
      .single();

    if (templateError || !promptTemplate) {
      console.error('❌ Error loading prompt template:', templateError);
      await markJobFailed(supabase, job.id, `Prompt template not found: ${templateError?.message}`);
      throw new Error(`Prompt template not found: ${templateError?.message}`);
    }

    console.log(`✅ Loaded prompt template: ${promptTemplate.name}`);

    // 🔍 DEBUG: Verify template_text is present
    console.log('🔍 DEBUG: Prompt template details:', {
      id: promptTemplate.id,
      name: promptTemplate.name,
      stage: promptTemplate.stage,
      has_template_text: !!promptTemplate.template_text,
      template_text_length: promptTemplate.template_text?.length || 0,
      template_text_preview: promptTemplate.template_text?.substring(0, 50) || 'MISSING'
    });

    // ===========================================
    // STEP 5: Load segments to process
    // ===========================================

    let segments: Segment[];

    if (profile.segment_ids && profile.segment_ids.length > 0) {
      // Use specified segments
      const { data: segmentData, error: segmentError } = await supabase
        .from('segments')
        .select('id, name, code')
        .in('id', profile.segment_ids)
        .eq('is_active', true);

      if (segmentError) {
        console.error('❌ Error loading segments:', segmentError);
        await markJobFailed(supabase, job.id, `Segments not found: ${segmentError.message}`);
        throw segmentError;
      }

      segments = segmentData || [];
    } else {
      // Load all active segments
      const { data: segmentData, error: segmentError } = await supabase
        .from('segments')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (segmentError) {
        console.error('❌ Error loading all segments:', segmentError);
        await markJobFailed(supabase, job.id, `Segments load failed: ${segmentError.message}`);
        throw segmentError;
      }

      segments = segmentData || [];
    }

    console.log(`✅ Loaded ${segments.length} segments to process`);

    // ===========================================
    // STEP 6: Process each segment
    // ===========================================

    let totalDocumentsCreated = 0;
    const errors: Array<{ segment_id: string; segment_name: string; error: string }> = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      console.log(`\n🔍 Processing segment ${i + 1}/${segments.length}: ${segment.name}`);

      try {
        // Update current segment
        await supabase
          .from('pipeline_jobs')
          .update({ current_segment_id: segment.id })
          .eq('id', job.id);

        // 🔍 DEBUG: Log what we're about to send to Source Hunter
        const hunterRequest = {
          prompt: promptTemplate.template_text,
          monitoring_profile_id: profile.id,
          segment_ids: [segment.id], // Process ONE segment at a time
          geography_ids: profile.geography_ids || undefined,
          min_source_priority: profile.min_source_priority,
          max_sources_per_run: profile.max_sources_per_run
        };

        console.log('🔍 DEBUG: Source Hunter request:', {
          prompt_length: hunterRequest.prompt?.length || 0,
          prompt_preview: hunterRequest.prompt?.substring(0, 50) || 'MISSING',
          monitoring_profile_id: hunterRequest.monitoring_profile_id,
          segment_ids: hunterRequest.segment_ids,
          geography_ids: hunterRequest.geography_ids,
          min_source_priority: hunterRequest.min_source_priority,
          max_sources_per_run: hunterRequest.max_sources_per_run
        });

        // Call Source Hunter for this segment
        const hunterResult = await callSourceHunter(supabaseUrl, supabaseServiceKey, hunterRequest);

        if (hunterResult.status === 'success') {
          totalDocumentsCreated += hunterResult.documents_created || 0;
          console.log(`✅ Segment ${segment.name}: ${hunterResult.documents_created} documents created`);
        } else {
          console.error(`❌ Segment ${segment.name} failed:`, hunterResult.error);
          errors.push({
            segment_id: segment.id,
            segment_name: segment.name,
            error: hunterResult.error || 'Unknown error'
          });
        }

        // Update progress
        await supabase
          .from('pipeline_jobs')
          .update({
            processed_segments: i + 1,
            documents_created: totalDocumentsCreated,
            errors: errors
          })
          .eq('id', job.id);

      } catch (error: any) {
        console.error(`❌ Error processing segment ${segment.name}:`, error);
        errors.push({
          segment_id: segment.id,
          segment_name: segment.name,
          error: error.message || 'Unknown error'
        });

        // Update errors but continue processing other segments
        await supabase
          .from('pipeline_jobs')
          .update({ errors: errors })
          .eq('id', job.id);
      }
    }

    // ===========================================
    // STEP 7: Mark job as completed or failed
    // ===========================================

    const finalStatus = errors.length === segments.length ? 'failed' : 'completed';

    await supabase
      .from('pipeline_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        processed_segments: segments.length,
        documents_created: totalDocumentsCreated,
        errors: errors,
        current_segment_id: null
      })
      .eq('id', job.id);

    console.log(`\n✅ Job ${job.id} ${finalStatus}!`);
    console.log(`   📊 Segments processed: ${segments.length}`);
    console.log(`   📄 Documents created: ${totalDocumentsCreated}`);
    console.log(`   ❌ Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        status: 'success',
        job_id: job.id,
        job_status: finalStatus,
        segments_processed: segments.length,
        documents_created: totalDocumentsCreated,
        errors_count: errors.length,
        errors: errors
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Job processor error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message || 'Unknown error',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ===========================================
// Helper: Call Source Hunter Edge Function
// ===========================================

async function callSourceHunter(
  supabaseUrl: string,
  serviceKey: string,
  request: {
    prompt: string;
    monitoring_profile_id: string;
    segment_ids?: string[];
    geography_ids?: string[];
    min_source_priority?: number;
    max_sources_per_run?: number;
  }
): Promise<SourceHunterResult> {
  try {
    // 🔍 DEBUG: Log what we're sending in HTTP body
    const requestBody = JSON.stringify(request);
    console.log('🔍 DEBUG: HTTP Request to Source Hunter:');
    console.log('   URL:', `${supabaseUrl}/functions/v1/source-hunter`);
    console.log('   Body length:', requestBody.length);
    console.log('   Body preview:', requestBody.substring(0, 200));
    console.log('   Parsed body:', JSON.parse(requestBody));

    const response = await fetch(`${supabaseUrl}/functions/v1/source-hunter`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Source Hunter HTTP error:', response.status, errorText);
      return {
        status: 'error',
        documents_created: 0,
        segment_links: 0,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();
    return {
      status: result.status || 'success',
      documents_created: result.documents_created || 0,
      segment_links: result.segment_links || 0,
      error: result.error
    };

  } catch (error: any) {
    console.error('❌ Source Hunter call failed:', error);
    return {
      status: 'error',
      documents_created: 0,
      segment_links: 0,
      error: error.message || 'Unknown error'
    };
  }
}

// ===========================================
// Helper: Mark job as failed
// ===========================================

async function markJobFailed(
  supabase: any,
  jobId: string,
  errorMessage: string
): Promise<void> {
  await supabase
    .from('pipeline_jobs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors: [{ error: errorMessage }]
    })
    .eq('id', jobId);
}
