"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  IN_FLIGHT_STEPS,
  type IngestionStep,
  deleteDocumentApi,
  getDocumentStatusApi,
} from "@/lib/api";

export type DocumentItem = {
  id: string;
  title: string;
  status: string;
  ingestion_step?: IngestionStep | null;
  ingestion_progress?: number | null;
  step_message?: string | null;
  is_deleting?: boolean | null;
  chunks_indexed?: number | null;
  page_count?: number | null;
  error_message?: string | null;
  created_at: string;
};

interface AnimatedDocumentListProps {
  initialDocuments: DocumentItem[];
}

function resolveStep(doc: DocumentItem): IngestionStep {
  if (doc.ingestion_step) return doc.ingestion_step;
  if (doc.status === "completed") return "completed";
  if (doc.status === "failed") return "failed";
  if (doc.status === "cancelled") return "cancelled";
  return "indexing";
}

export function AnimatedDocumentList({
  initialDocuments,
}: AnimatedDocumentListProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>(() =>
    initialDocuments.filter(
      (doc) => !doc.is_deleting && resolveStep(doc) !== "cancelled"
    )
  );
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // Sync when server props refresh while respecting optimistically deleted IDs
  useEffect(() => {
    setDocuments(
      initialDocuments.filter(
        (doc) =>
          !deletedIdsRef.current.has(doc.id) &&
          !doc.is_deleting &&
          resolveStep(doc) !== "cancelled"
      )
    );
  }, [initialDocuments]);

  const inFlightIds = useMemo(
    () =>
      documents
        .filter(
          (doc) =>
            !deletingIds[doc.id] &&
            !deletedIdsRef.current.has(doc.id) &&
            IN_FLIGHT_STEPS.has(resolveStep(doc))
        )
        .map((doc) => doc.id),
    [documents, deletingIds]
  );

  const inFlightKey = inFlightIds.join(",");

  // Poll status only while in-flight documents exist
  useEffect(() => {
    if (!inFlightKey) return;

    const idsToPoll = inFlightKey.split(",");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const poll = async () => {
      if (!active) return;
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token || !active) return;

      let shouldRefreshServer = false;

      await Promise.all(
        idsToPoll.map(async (docId) => {
          if (deletedIdsRef.current.has(docId) || !active) return;
          try {
            const status = await getDocumentStatusApi(
              docId,
              token,
              controller.signal
            );

            if (!active || deletedIdsRef.current.has(docId)) return;

            if (status.is_deleting || status.ingestion_step === "cancelled") {
              deletedIdsRef.current.add(docId);
              setDocuments((prev) => prev.filter((d) => d.id !== docId));
              shouldRefreshServer = true;
              return;
            }

            if (!IN_FLIGHT_STEPS.has(status.ingestion_step)) {
              shouldRefreshServer = true;
            }

            setDocuments((prev) =>
              prev.map((doc) =>
                doc.id === docId
                  ? {
                      ...doc,
                      status:
                        status.ingestion_step === "completed"
                          ? "completed"
                          : status.ingestion_step === "failed"
                          ? "failed"
                          : "processing",
                      ingestion_step: status.ingestion_step,
                      ingestion_progress: status.ingestion_progress,
                      step_message: status.step_message,
                      is_deleting: status.is_deleting,
                      chunks_indexed: status.chunks_indexed,
                      page_count: status.page_count,
                      error_message: status.error_message,
                    }
                  : doc
              )
            );
          } catch {
            // Ignore transient poll errors or AbortError
          }
        })
      );

      if (shouldRefreshServer && active) {
        router.refresh();
      }

      if (active) {
        timer = setTimeout(poll, 1200);
      }
    };

    timer = setTimeout(poll, 800);

    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [inFlightKey, router]);

  const handleDelete = async (doc: DocumentItem) => {
    if (deletingIds[doc.id] || deletedIdsRef.current.has(doc.id)) {
      return;
    }

    const step = resolveStep(doc);
    const inFlight = IN_FLIGHT_STEPS.has(step);
    const promptMessage = inFlight
      ? `Cancel ingestion and delete "${doc.title}"? Any partially indexed chunks and uploaded files will be cleaned up.`
      : "Are you sure you want to permanently delete this document and all its indexed data?";

    if (!window.confirm(promptMessage)) {
      return;
    }

    setDeletingIds((prev) => ({ ...prev, [doc.id]: true }));
    deletedIdsRef.current.add(doc.id);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired.");
      }

      await deleteDocumentApi(session.access_token, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      router.refresh();
    } catch (err) {
      deletedIdsRef.current.delete(doc.id);
      alert(err instanceof Error ? err.message : "Error deleting document");
    } finally {
      setDeletingIds((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
    }
  };

  const stepClassname: Record<IngestionStep, string> = {
    uploading: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    chunking: "bg-indigo-500/10 text-indigo-300 border-indigo-500/25",
    indexing: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    cancelled: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: {
      opacity: 0,
      scale: 0.95,
      height: 0,
      marginBottom: 0,
      transition: { duration: 0.2 },
    },
  };

  return (
    <div className="rounded-3xl border border-white/10 glass-panel p-6 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20 text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-bold text-white">Recent Documents</h3>
        </div>
      </div>

      <motion.div
        className="space-y-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {documents.length ? (
            documents.map((document) => {
              const step = resolveStep(document);
              const inFlight = IN_FLIGHT_STEPS.has(step);
              const isRowDeleting = Boolean(deletingIds[document.id]);
              const progress = Math.max(
                0,
                Math.min(100, document.ingestion_progress ?? (inFlight ? 15 : 100))
              );

              return (
                <motion.div
                  key={document.id}
                  variants={itemVariants}
                  exit="exit"
                  layout
                  className="group relative rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-indigo-500/50 hover:bg-white/10 overflow-hidden"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 pr-4">
                      <Link
                        href={`/dashboard/documents/${document.id}`}
                        className="block truncate text-lg font-medium text-white transition group-hover:text-indigo-300"
                      >
                        {document.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span>
                          Created: {new Date(document.created_at).toLocaleString()}
                        </span>
                        {typeof document.page_count === "number" &&
                        document.page_count > 0 ? (
                          <span>{document.page_count} pages</span>
                        ) : null}
                        {typeof document.chunks_indexed === "number" &&
                        document.chunks_indexed > 0 ? (
                          <span>{document.chunks_indexed} chunks</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize shadow-sm ${
                          stepClassname[step] ??
                          "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {step === "completed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : step === "failed" ? (
                          <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                        ) : inFlight ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        )}
                        {isRowDeleting ? "Deleting..." : step}
                        {inFlight && !isRowDeleting ? ` (${progress}%)` : ""}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDelete(document)}
                        disabled={isRowDeleting}
                        className={`${
                          inFlight
                            ? "opacity-100 bg-rose-500/10 border border-rose-500/25"
                            : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                        } transition-opacity p-2 rounded-lg text-rose-400 hover:bg-rose-500/20 focus:outline-none disabled:opacity-50`}
                        title={
                          inFlight
                            ? "Cancel Ingestion & Delete"
                            : "Delete Document"
                        }
                      >
                        {isRowDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {inFlight ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span className="truncate">
                          {document.step_message || "Processing document..."}
                        </span>
                        <span className="ml-2 font-mono text-slate-400">
                          {progress}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                          style={{ width: `${Math.max(4, progress)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {step === "failed" && document.error_message ? (
                    <p className="mt-2 truncate text-xs text-rose-400">
                      {document.error_message}
                    </p>
                  ) : null}
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-slate-400 mb-4">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-base font-medium text-slate-300">
                No documents yet
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Upload your first PDF above to start ingestion and chat.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}