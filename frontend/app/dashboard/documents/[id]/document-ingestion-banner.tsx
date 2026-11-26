"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  IN_FLIGHT_STEPS,
  type IngestionStep,
  deleteDocumentApi,
  getDocumentStatusApi,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface DocumentIngestionBannerProps {
  documentId: string;
  documentTitle: string;
  initialStep: IngestionStep;
  initialProgress: number;
  initialMessage: string | null;
  initialError: string | null;
  initialChunksIndexed: number | null;
  initialPageCount: number | null;
}

const STAGES: { key: IngestionStep; label: string }[] = [
  { key: "uploading", label: "Uploading" },
  { key: "chunking", label: "Chunking" },
  { key: "indexing", label: "Indexing" },
];

export function DocumentIngestionBanner({
  documentId,
  documentTitle,
  initialStep,
  initialProgress,
  initialMessage,
  initialError,
  initialChunksIndexed,
  initialPageCount,
}: DocumentIngestionBannerProps) {
  const router = useRouter();
  const [step, setStep] = useState<IngestionStep>(initialStep);
  const [progress, setProgress] = useState<number>(initialProgress);
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [error, setError] = useState<string | null>(initialError);
  const [chunksIndexed, setChunksIndexed] = useState<number | null>(
    initialChunksIndexed
  );
  const [pageCount, setPageCount] = useState<number | null>(initialPageCount);
  const [isDeleting, setIsDeleting] = useState(false);

  const deletedRef = useRef(false);
  const inFlight = IN_FLIGHT_STEPS.has(step);

  useEffect(() => {
    if (!inFlight || deletedRef.current) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const poll = async () => {
      if (!active || deletedRef.current) return;

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token || !active) return;

      try {
        const status = await getDocumentStatusApi(
          documentId,
          token,
          controller.signal
        );

        if (!active || deletedRef.current) return;

        setStep(status.ingestion_step);
        setProgress(status.ingestion_progress ?? 0);
        setMessage(status.step_message ?? null);
        if (typeof status.chunks_indexed === "number") {
          setChunksIndexed(status.chunks_indexed);
        }
        if (typeof status.page_count === "number") {
          setPageCount(status.page_count);
        }

        if (status.is_deleting || status.ingestion_step === "cancelled") {
          deletedRef.current = true;
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        if (status.ingestion_step === "failed") {
          setError(
            status.error_message ||
              status.step_message ||
              "Document ingestion failed."
          );
          router.refresh();
          return;
        }

        if (status.ingestion_step === "completed") {
          setProgress(100);
          router.refresh();
          return;
        }
      } catch {
        // Ignore transient poll errors or AbortError
      }

      if (active && !deletedRef.current) {
        timer = setTimeout(poll, 1000);
      }
    };

    timer = setTimeout(poll, 600);

    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [documentId, inFlight, router]);

  const handleDelete = async () => {
    if (isDeleting || deletedRef.current) return;

    const confirmText = inFlight
      ? `Cancel ingestion and delete "${documentTitle}"? Partial chunks and storage files will be removed.`
      : `Permanently delete "${documentTitle}" and all indexed data?`;

    if (!window.confirm(confirmText)) return;

    setIsDeleting(true);
    deletedRef.current = true;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired.");
      }

      await deleteDocumentApi(session.access_token, documentId);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      deletedRef.current = false;
      setIsDeleting(false);
      alert(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  if (step === "completed") {
    return null;
  }

  const activeStageIndex = STAGES.findIndex((s) => s.key === step);

  return (
    <div className="rounded-3xl border border-white/10 glass-panel bg-black/30 p-6 shadow-lg space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          {step === "failed" ? (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400 shrink-0" />
          )}
          <div>
            <h3 className="text-base font-semibold text-white">
              {step === "failed"
                ? "Ingestion Failed"
                : "Document Ingestion in Progress"}
            </h3>
            <p className="text-xs text-slate-400">
              {step === "failed"
                ? error || "An error occurred while processing this file."
                : "Chat, summary, and entity extraction will unlock automatically once indexing finishes."}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-xl border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 self-start sm:self-auto"
        >
          {isDeleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          {isDeleting
            ? "Deleting..."
            : inFlight
            ? "Cancel & Delete"
            : "Delete Document"}
        </Button>
      </div>

      {inFlight ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {STAGES.map((stage, idx) => {
              const isDone = activeStageIndex > idx;
              const isCurrent = step === stage.key;

              return (
                <div
                  key={stage.key}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium ${
                    isDone
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : isCurrent
                      ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300"
                      : "border-white/10 bg-white/5 text-slate-400"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  ) : null}
                  <span>{stage.label}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>{message || "Processing document..."}</span>
              <span className="font-mono font-semibold">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
              />
            </div>
          </div>

          {pageCount !== null || chunksIndexed !== null ? (
            <div className="flex gap-4 text-xs text-slate-400">
              {pageCount !== null ? <span>Pages: {pageCount}</span> : null}
              {chunksIndexed !== null ? (
                <span>Chunks indexed: {chunksIndexed}</span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}