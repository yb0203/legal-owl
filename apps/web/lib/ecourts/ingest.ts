// Order ingestion — create a document record for every court order, download
// the PDF when available, OCR via eCourts, and fire document.uploaded.
// Server-only.

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { runAmbient } from "@/lib/agents/orchestrator";
import type { NormalizedOrder } from "@/lib/ecourts/types";

interface IngestContext {
  supabase: SupabaseClient;
  lawyerId: string;
  matterId: string;
}

/**
 * Create a document record for a court order from eCourts.
 * When a PDF URL is available, downloads and stores it.
 * Always creates a document entry — even orders without downloadable PDFs
 * appear in the Documents tab so the lawyer knows they exist.
 */
export async function ingestOrder(
  ctx: IngestContext,
  order: NormalizedOrder,
): Promise<string | null> {
  const { supabase, lawyerId, matterId } = ctx;

  // Idempotency: skip if this order date is already recorded for this matter.
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("matter_id", matterId)
    .eq("source", "court_order")
    .eq("ecourts_order_date", order.order_date)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const orderName = `${order.order_type === "judgment" ? "Judgment" : "Order"} — ${order.order_date}`;

  // No URL: create a stub so the order is visible in the Documents tab.
  if (!order.url) {
    const { data: stub } = await supabase
      .from("documents")
      .insert({
        lawyer_id: lawyerId,
        matter_id: matterId,
        name: orderName,
        storage_path: "",
        source: "court_order",
        ecourts_order_date: order.order_date,
        ecourts_order_type: order.order_type ?? "order",
        ocr_text: order.ocr_markdown ?? null,
        ocr_status: order.ocr_markdown ? "done" : "na",
      })
      .select("id")
      .single();
    return (stub?.id as string) ?? null;
  }

  // Try to download the PDF.
  let pdfBuffer: ArrayBuffer | null = null;
  try {
    const res = await fetch(order.url, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) pdfBuffer = await res.arrayBuffer();
  } catch (err) {
    console.error("[ingestOrder] PDF download failed:", err);
  }

  if (!pdfBuffer) {
    // URL present but download failed — record the order with the URL as
    // storage_path so the lawyer can still open it from the eCourts portal.
    const { data: stub } = await supabase
      .from("documents")
      .insert({
        lawyer_id: lawyerId,
        matter_id: matterId,
        name: orderName,
        storage_path: order.url,      // store the eCourts URL directly
        source: "court_order",
        ecourts_order_date: order.order_date,
        ecourts_order_type: order.order_type ?? "order",
        ocr_text: order.ocr_markdown ?? null,
        ocr_status: "failed",
      })
      .select("id")
      .single();
    return (stub?.id as string) ?? null;
  }

  // Upload PDF to Storage.
  const storagePath = `${lawyerId}/${matterId}/orders/${order.order_date}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("case-documents")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    console.error("[ingestOrder] Storage upload failed:", uploadError.message);
    // Fall back to storing the eCourts URL.
    const { data: stub } = await supabase
      .from("documents")
      .insert({
        lawyer_id: lawyerId,
        matter_id: matterId,
        name: orderName,
        storage_path: order.url,
        source: "court_order",
        ecourts_order_date: order.order_date,
        ecourts_order_type: order.order_type ?? "order",
        ocr_text: order.ocr_markdown ?? null,
        ocr_status: "failed",
      })
      .select("id")
      .single();
    return (stub?.id as string) ?? null;
  }

  const ocrStatus = order.ocr_markdown ? "done" : "pending";
  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      lawyer_id: lawyerId,
      matter_id: matterId,
      name: orderName,
      storage_path: storagePath,
      mime_type: "application/pdf",
      source: "court_order",
      ecourts_order_date: order.order_date,
      ecourts_order_type: order.order_type ?? "order",
      ocr_text: order.ocr_markdown ?? null,
      ocr_status: ocrStatus,
    })
    .select("id")
    .single();

  if (insertError || !doc) {
    console.error("[ingestOrder] Document insert failed:", insertError?.message);
    return null;
  }

  const documentId = doc.id as string;

  // Fire document.uploaded so agents can extract facts.
  if (order.ocr_markdown) {
    try {
      await runAmbient(
        { type: "document.uploaded", matter_id: matterId, document_id: documentId },
        { supabase, user: { id: lawyerId } as unknown as User },
      );
    } catch (err) {
      console.error("[ingestOrder] runAmbient failed:", err);
    }
  }

  return documentId;
}
