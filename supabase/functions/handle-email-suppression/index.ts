import { createClient } from 'npm:@supabase/supabase-js@2'
import { Webhook } from 'npm:svix'

// Resend sends webhook events for delivery outcomes (bounce, complaint, etc.)
// signed via Svix. The signing secret is set in Resend's dashboard when
// configuring the webhook endpoint, and stored here as RESEND_WEBHOOK_SECRET.
// ASSUMPTION: Resend's webhook signing secret must be passed to the Svix
// Webhook constructor exactly as shown in Resend's dashboard (including the
// "whsec_" prefix). Verify this matches Svix's expected format if verification
// fails — some versions strip the prefix automatically, others require it.

interface ResendWebhookData {
  email_id: string
  from: string
  to: string[]  // Resend puts recipients in an array
  subject: string
  created_at: string
}

interface ResendWebhookEvent {
  type: string
  created_at: string
  data: ResendWebhookData
}

// Maps Resend event types to suppression reasons.
// Note: Resend does not send a distinct unsubscribe webhook event — unsubscribes
// in this app are handled separately via handle-email-unsubscribe and the
// app's own unsubscribe link. The 'unsubscribe' case from the old Lovable/
// Mailgun integration has no equivalent here.
function mapEventTypeToReason(type: string): 'bounce' | 'complaint' | null {
  switch (type) {
    case 'email.bounced':    return 'bounce'
    case 'email.complained': return 'complaint'
    default:                 return null
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables (RESEND_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Read the raw body before any other parsing — Svix verifies the exact bytes.
  const body = await req.text()

  // Svix sends three headers that together form the HMAC signature.
  const svixId        = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('Missing Svix signature headers')
    return jsonResponse({ error: 'Missing signature headers' }, 400)
  }

  // Verify and parse the webhook payload.
  let event: ResendWebhookEvent
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(body, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent
  } catch (error) {
    console.error('Webhook verification failed', { error: String(error) })
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  // Only bounce and complaint events trigger suppression. All others are
  // acknowledged and ignored so Resend doesn't keep retrying delivery.
  const reason = mapEventTypeToReason(event.type)
  if (!reason) {
    console.log('Ignoring non-suppression event', { type: event.type })
    return jsonResponse({ success: true, ignored: true })
  }

  // Resend puts the recipient list in an array; take the first (and typically only) entry.
  const recipientEmail = event.data?.to?.[0]
  if (!recipientEmail) {
    console.error('Missing recipient email in webhook payload', { type: event.type })
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  const emailId = event.data?.email_id ?? null

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = recipientEmail.toLowerCase()

  // 1. Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason,
        metadata: null,
      },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Append a new log entry for the suppression event (never update existing rows)
  const sendLogStatus = mapReasonToStatus(reason)
  const sendLogMessage = mapReasonToMessage(reason)

  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: emailId,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: sendLogStatus,
      error_message: sendLogMessage,
      metadata: null,
    })

  if (insertError) {
    // Non-fatal — log and continue. The suppression was already recorded.
    console.warn('Failed to insert email_send_log', { error: insertError })
  }

  console.log('Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason,
    event_type: event.type,
    email_id: emailId,
  })

  return jsonResponse({ success: true })
})

function mapReasonToStatus(
  reason: string,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    default:
      return 'Email suppressed'
  }
}
