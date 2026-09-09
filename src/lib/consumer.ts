/**
 * Consumer-portal persistence.
 *
 * Everything here writes to the existing tables (`consumer_checks`,
 * `complaints`, `profiles`, `notifications`) through the signed-in user's own
 * session, so row-level security keeps each shopper to their own records.
 * The Legal Metrology rule engine is untouched — its output is only stored.
 */
import { supabase } from "@/integrations/supabase/client";
import { signedUrl, uploadDataUrl } from "@/lib/db";
import type { ExtractedField } from "@/pipeline/types";
import type { InspectionClassification } from "@/legal/types";

export interface ConsumerRuleResult {
  rule_id: string;
  title: string;
  outcome: string;
  summary: string | null;
  reason: string | null;
}

export interface ConsumerCheckPayload {
  v: 1;
  productName: string;
  classification: InspectionClassification;
  fields: ExtractedField[];
  results: ConsumerRuleResult[];
  observations: string[];
  imagePath: string | null;
  imageThumb: string | null;
}

export interface ConsumerCheckRow {
  id: string;
  product_name: string | null;
  status: string | null;
  confidence: number | null;
  created_at: string;
  package_image_url: string | null;
  findings: unknown;
}

export async function saveConsumerCheck(input: {
  productName: string;
  status: string;
  confidence: number;
  payload: Omit<ConsumerCheckPayload, "v" | "imagePath">;
  imageDataUrl: string | null;
}): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  const { data: row, error } = await supabase
    .from("consumer_checks")
    .insert({
      consumer_id: uid,
      product_name: input.productName,
      status: input.status,
      confidence: input.confidence,
      findings: { v: 1, ...input.payload, imagePath: null } as never,
    })
    .select("id")
    .maybeSingle();

  if (error || !row?.id) return null;

  // The package photograph goes to the existing private bucket; only the path
  // is stored on the row.
  if (input.imageDataUrl) {
    const path = await uploadDataUrl("package-images", `${uid}/consumer/${row.id}.jpg`, input.imageDataUrl);
    if (path) {
      await supabase
        .from("consumer_checks")
        .update({
          package_image_url: path,
          findings: { v: 1, ...input.payload, imagePath: path } as never,
        })
        .eq("id", row.id);
    }
  }
  return row.id;
}

export async function listMyChecks(): Promise<ConsumerCheckRow[]> {
  const { data } = await supabase
    .from("consumer_checks")
    .select("id, product_name, status, confidence, created_at, package_image_url, findings")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as ConsumerCheckRow[];
}

export async function getMyCheck(id: string): Promise<ConsumerCheckRow | null> {
  const { data } = await supabase
    .from("consumer_checks")
    .select("id, product_name, status, confidence, created_at, package_image_url, findings")
    .eq("id", id)
    .maybeSingle();
  return (data as ConsumerCheckRow | null) ?? null;
}

export async function checkImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  return signedUrl("package-images", path, 3600);
}

/* ------------------------------------------------------------------ */
/* Complaints                                                          */
/* ------------------------------------------------------------------ */

export interface ComplaintRow {
  id: string;
  product: string;
  seller: string | null;
  issue_type: string;
  description: string;
  status: string;
  image_url: string | null;
  created_at: string;
}

export const ISSUE_TYPES = [
  "Price higher than printed MRP",
  "MRP sticker or overprint on the pack",
  "Net quantity missing or wrong",
  "Manufacturer or packer details missing",
  "Dates missing or unreadable",
  "Consumer care details missing",
  "Other labelling problem",
];

export async function submitComplaint(input: {
  product: string;
  seller: string;
  issueType: string;
  description: string;
  imageDataUrl: string | null;
}): Promise<{ id: string } | { error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { error: "Please sign in again to submit a complaint." };

  const { data: row, error } = await supabase
    .from("complaints")
    .insert({
      consumer_id: uid,
      product: input.product,
      seller: input.seller || null,
      issue_type: input.issueType,
      description: input.description,
    })
    .select("id")
    .maybeSingle();
  if (error || !row?.id) return { error: error?.message ?? "The complaint could not be saved." };

  if (input.imageDataUrl) {
    const path = await uploadDataUrl("evidence", `${uid}/complaints/${row.id}.jpg`, input.imageDataUrl);
    if (path) await supabase.from("complaints").update({ image_url: path }).eq("id", row.id);
  }
  return { id: row.id };
}

export async function listMyComplaints(): Promise<ComplaintRow[]> {
  const { data } = await supabase
    .from("complaints")
    .select("id, product, seller, issue_type, description, status, image_url, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as ComplaintRow[];
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

export interface ConsumerProfile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  district: string | null;
}

export async function getMyProfile(): Promise<ConsumerProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, phone, district")
    .eq("id", auth.user.id)
    .maybeSingle();
  return (data as ConsumerProfile | null) ?? null;
}

export async function updateMyProfile(input: ConsumerProfile): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in again." };
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name,
      phone: input.phone,
      district: input.district,
    })
    .eq("id", auth.user.id);
  return error ? { error: error.message } : {};
}

export async function changeMyPassword(password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: error.message } : {};
}

export interface NotificationRow {
  id: string;
  title: string | null;
  message: string | null;
  read: boolean;
  created_at: string;
}

export async function listMyNotifications(): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, title, message, read, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function deleteNotification(id: string): Promise<void> {
  await supabase.from("notifications").delete().eq("id", id);
}
