import { notFound, redirect } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";

import { DocumentTabs } from "./document-tabs";
import { DocumentIngestionBanner } from "./document-ingestion-banner";
import { IN_FLIGHT_STEPS, type IngestionStep } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

function resolveStep(doc: {
  status: string;
  ingestion_step?: string | null;
}): IngestionStep {
  if (doc.ingestion_step) return doc.ingestion_step as IngestionStep;
  if (doc.status === "completed") return "completed";
  if (doc.status === "failed") return "failed";
  if (doc.status === "cancelled") return "cancelled";
  return "indexing";
}

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: document } = await supabase
    .from("documents")
    .select(
      "id,title,status,ingestion_step,ingestion_progress,step_message,is_deleting,chunks_indexed,page_count,error_message,created_at,summary,entities"
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!document) {
    notFound();
  }

  const step = resolveStep(document);

  if (document.is_deleting || step === "cancelled") {
    redirect("/dashboard");
  }

  const inFlight = IN_FLIGHT_STEPS.has(step);

  const { data: chatMessages } = await supabase
    .from("chat_messages")
    .select("role,content,created_at")
    .eq("document_id", params.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/10 glass-panel bg-black/20 p-6 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
              <FileText className="h-3.5 w-3.5" />
              Document Workspace
            </p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              {document.title}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Created: {new Date(document.created_at).toLocaleString()}
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium capitalize shadow-sm ${
              step === "completed"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : inFlight
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                : step === "failed"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {step}
          </span>
        </div>
      </div>

      {step !== "completed" ? (
        <DocumentIngestionBanner
          documentId={document.id}
          documentTitle={document.title}
          initialStep={step}
          initialProgress={document.ingestion_progress ?? (inFlight ? 15 : 0)}
          initialMessage={document.step_message ?? null}
          initialError={document.error_message ?? null}
          initialChunksIndexed={document.chunks_indexed ?? null}
          initialPageCount={document.page_count ?? null}
        />
      ) : (
        <DocumentTabs
          userId={user.id}
          document={document}
          initialMessages={chatMessages ?? []}
        />
      )}
    </section>
  );
}