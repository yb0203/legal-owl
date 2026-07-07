// Order PDF ingestion — download, store, OCR, and fire document.uploaded.
// Server-only. Called from sync.ts on each genuinely-new order_uploaded event.
// Best-effort: failures are logged and set ocr_status='failed' without throwing
// so a broken PDF download never aborts the sync.

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { runAmbient } from "@/lib/agents/orchestrator";
import type { NormalizedOrder } from "@/lib/ecourts/types";

interface IngestContext {
  supabase: SupabaseClient;
  lawyerId: string;
  matterId: string;
}

/**
 * Download an order PDF, store it in case-documents, populate OCR text from
 * the eCourts OCR markdown, and fire the document.uploaded ambient event so
 * Intake Registrar and Limitation Clerk can extract facts.
 *
 * Returns the inserted document id, or null on failure.
 */
export async function ingestOrder(
  ctx: IngestContext,
  order: NormalizedOrder,
): Promise<string | null> {
  const { supabase, lawyerId, matterId } = ctx;

  if (!order.url) return null;

  // Idempotency: skip if a document for this order date + matter already exists.
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("matter_id", matterId)
    .eq("source", "court_order")
    .eq("ecourts_order_date", order.order_date)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  // 1. Download the PDF.
  let pdfBuffer: ArrayBuffer | null = null;
  try {
    const res = await fetch(order.url, { signal: AbortSignal.timeout(30_000) });
    if (res.ok) pdfBuffer = await res.arrayBuffer();
  } catch (err) {
    console.error("[ingestOrder] PDF download failed:", err);
  }

  if (!pdfBuffer) {
    // Can't download — insert a stub row with ocr_status='failed' so we know
    // the order exists even without the PDF.
    const { data: stub } = await supabase
      .from("documents")
      .insert({
        lawyer_id: lawyerId,
        matter_id: matterId,
        name: `Order ${order.order_date}`,
        storage_path: "",
        source: "court_order",
        ecourts_order_date: order.order_date,
        ecourts_order_type: order.order_type ?? "order",
        ocr_status: "failed",
        ocr_text: order.ocr_markdown ?? null,
      })
      .select("id")
      .single();
    return (stub?.id as string) ?? null;
  }

  // 2. Upload to Storage: ${lawyerId}/${matterId}/orders/${order_date}.pdf
  const storagePath = `${lawyerId}/${matterId}/orders/${order.order_date}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("case-documents")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true, // safe re-upload for retries
    });

  if (uploadError) {
    console.error("[ingestOrder] Storage upload failed:", uploadError.message);
    return null;
  }

  // 3. Insert the documents row.
  const ocrStatus = order.ocr_markdown ? "done" : "pending";
  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      lawyer_id: lawyerId,
      matter_id: matterId,
      name: `Order ${order.order_date}`,
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

  // 4. Fire document.uploaded so Intake Registrar and Limitation Clerk can act.
  //    Only fires when OCR text is available (otherwise agents have nothing to cite).
  if (order.ocr_markdown) {
    try {
      await runAmbient(
        { type: "document.uploaded", matter_id: matterId, document_id: documentId },
        { supabase, user: { id: lawyerId } as unknown as User },
      );
    } catch (err) {
      // Agent failures never abort the ingestion.
      console.error("[ingestOrder] runAmbient failed:", err);
    }
  }

  return documentId;
}
