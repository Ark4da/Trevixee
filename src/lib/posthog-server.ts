/**
 * PostHog server-side client (P2-51)
 * Use for server-side event tracking in route handlers and server components.
 *
 * Usage:
 *   import { captureEvent } from "@/lib/posthog-server";
 *   await captureEvent(userId, "subscription_created", { plan: "pro" });
 */
import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST ?? "https://eu.posthog.com";
  if (!key) return null;
  if (!_client) {
    _client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  }
  return _client;
}

export async function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const client = getClient();
  if (!client) return;
  client.capture({ distinctId, event, properties });
  await client.flush();
}

/**
 * Key product funnel events:
 * - signup
 * - trial_started
 * - subscription_created  { plan, interval }
 * - subscription_canceled { plan }
 * - payment_failed        { plan }
 * - workspace_created
 * - invite_sent
 * - invite_accepted
 * - csv_import            { rowCount }
 * - trade_added
 * - playbook_created
 */
