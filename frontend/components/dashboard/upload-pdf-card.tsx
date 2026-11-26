"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileUp,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IN_FLIGHT_STEPS,
  type IngestionStep,
  deleteDocumentApi,
  getDocumentStatusApi,
  ingestDocumentApi,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "documents";

const PIPELINE_STAGES: { key: IngestionStep; label: string }[] = [
  { key: "uploading", label: "Uploading" },
  { key: "chunking", label: "Chunking" },
  { key: "indexing", label: "Indexing" },
];

export function UploadPdfCard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [step, setStep] = useState<IngestionStep | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [chunksIndexed, setChunksIndexed] = useState<number | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const accessTokenRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopPolling = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Poll GET /api/v1/documents/{id}/status while activeDocId is in flight
  useEffect(() => {
    if (
      !activeDocId ||
      !step ||
      !IN_FLIGHT_STEPS.has(step) ||
      cancelledRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const pollStatus = async () => {
      if (!active || cancelledRef.current) return;
      const token = accessTokenRef.current;
      if (!token) return;

      try {
        const status = await getDocumentStatusApi(
          activeDocId,
          token,
          controller.signal
        );

        if (!active || cancelledRef.current) return;

        setStep(status.ingestion_step);
        setProgress(status.ingestion_progress ?? 0);
        setStepMessage(status.step_message ?? null);
        if (typeof status.chunks_indexed === "number") {
          setChunksIndexed(status.chunks_indexed);
        }
        if (typeof status.page_count === "number") {
          setPageCount(status.page_count);
        }

        if (status.ingestion_step === "failed") {
          setError(
            status.error_message || status.step_message || "Ingestion failed."
          );
          setIsUploading(false);
          return;
        }

        if (status.ingestion_step === "cancelled" || status.is_deleting) {
          setStep("cancelled");
          setStepMessage("Ingestion cancelled and cleaned up.");
          setIsUploading(false);
          return;
        }

        if (status.ingestion_step === "completed") {
          setProgress(100);
          setStepMessage(status.step_message || "Ingestion complete");
          setSuccess("Document ingested, chunked, and indexed for hybrid search.");
          setIsUploading(false);
          setFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          router.refresh();
          return;
        }
      } catch {
        // Ignore transient poll errors or AbortError while ingest request is still running
      }

      if (active && !cancelledRef.current) {
        timer = setTimeout(pollStatus, 1000);
      }
    };

    timer = setTimeout(pollStatus, 700);

    return () => {
      active = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [activeDocId, step, router]);

  const handleCancelAndDelete = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    cancelledRef.current = true;
    stopPolling();

    try {
      const token = accessTokenRef.current;
      if (activeDocId && token) {
        await deleteDocumentApi(token, activeDocId);
      }
      setStep("cancelled");
      setStepMessage("Upload cancelled and partial data removed.");
      setSuccess(null);
      setError(null);
      setActiveDocId(null);
      setIsUploading(false);
      router.refresh();
    } catch (cancelErr) {
      setError(
        cancelErr instanceof Error
          ? cancelErr.message
          : "Failed to cancel document ingestion."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const onUpload = async () => {
    let discoverTimer: ReturnType<typeof setInterval> | null = null;

    try {
      setError(null);
      setSuccess(null);
      setActiveDocId(null);
      setChunksIndexed(null);
      setPageCount(null);
      cancelledRef.current = false;

      if (!file) {
        setError("Select a document file first.");
        return;
      }

      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
      ];

      if (!allowedTypes.includes(file.type)) {
        setError(
          "Unsupported file format. Please upload PDF, DOCX, XLSX, or CSV."
        );
        return;
      }

      setIsUploading(true);
      setStep("uploading");
      setProgress(5);
      setStepMessage("Uploading file to private storage...");

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (userError || !user) {
        throw new Error("You must be logged in to upload documents.");
      }
      if (!session?.access_token) {
        throw new Error("Session expired. Please sign out and sign in again.");
      }

      accessTokenRef.current = session.access_token;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase frontend environment variables.");
      }

      // Force an authenticated JWT for storage upload so auth.uid() is available in RLS checks.
      const storageClient = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const filePath = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await storageClient.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes("row-level security")) {
          throw new Error(
            "Upload blocked by storage RLS. Ensure storage.sql has been applied in Supabase."
          );
        }
        if (uploadError.message.toLowerCase().includes("bucket")) {
          throw new Error(
            "Storage bucket not found. Create a private bucket named 'documents'."
          );
        }
        throw new Error(uploadError.message);
      }

      if (cancelledRef.current) {
        await storageClient.storage
          .from(STORAGE_BUCKET)
          .remove([filePath])
          .catch(() => null);
        return;
      }

      setProgress(12);
      setStepMessage("Starting ingestion pipeline...");

      // Discover the newly inserted document row while /ingest runs so status polling can track live steps
      let discoveredId: string | null = null;
      discoverTimer = setInterval(async () => {
        if (discoveredId || cancelledRef.current) return;
        const { data } = await supabase
          .from("documents")
          .select("id")
          .eq("user_id", user.id)
          .eq("file_path", filePath)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.id && !discoveredId) {
          discoveredId = String(data.id);
          setActiveDocId(discoveredId);
          if (discoverTimer) {
            clearInterval(discoverTimer);
            discoverTimer = null;
          }
          if (cancelledRef.current && accessTokenRef.current) {
            await deleteDocumentApi(accessTokenRef.current, discoveredId).catch(
              () => null
            );
          }
        }
      }, 450);

      const ingestResult = await ingestDocumentApi(session.access_token, {
        user_id: user.id,
        bucket: STORAGE_BUCKET,
        file_path: filePath,
        title: file.name,
        mime_type: file.type,
      });

      if (discoverTimer) {
        clearInterval(discoverTimer);
        discoverTimer = null;
      }

      if (cancelledRef.current) {
        if (ingestResult.document_id) {
          await deleteDocumentApi(
            session.access_token,
            ingestResult.document_id
          ).catch(() => null);
        }
        return;
      }

      stopPolling();
      setActiveDocId(ingestResult.document_id);
      setStep(ingestResult.ingestion_step ?? "completed");
      setProgress(ingestResult.ingestion_progress ?? 100);
      setStepMessage(ingestResult.step_message ?? "Ingestion complete");
      setChunksIndexed(ingestResult.chunks_indexed);
      setPageCount(ingestResult.page_count);
      setSuccess(
        `Ingestion complete (${ingestResult.chunks_indexed} chunks across ${ingestResult.page_count} pages).`
      );
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsUploading(false);
      router.refresh();
    } catch (uploadErr) {
      if (discoverTimer) {
        clearInterval(discoverTimer);
        discoverTimer = null;
      }
      stopPolling();

      if (cancelledRef.current) {
        setIsUploading(false);
        return;
      }

      const message =
        uploadErr instanceof Error ? uploadErr.message : "Unexpected upload error";

      if (
        message.toLowerCase().includes("cancelled") ||
        message.toLowerCase().includes("conflict")
      ) {
        setStep("cancelled");
        setStepMessage("Ingestion cancelled due to deletion.");
      } else {
        setStep("failed");
        setError(message);
      }
      setIsUploading(false);
    }
  };

  const activeStageIndex =
    step === "completed"
      ? PIPELINE_STAGES.length
      : PIPELINE_STAGES.findIndex((s) => s.key === step);

  return (
    <Card className="overflow-hidden rounded-3xl glass-panel border-white/10 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl text-white">Upload and Index</CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-slate-400">
              Upload your PDF, DOCX, XLSX, or CSV. The system will automatically
              chunk, index, summarize, and extract entities.
            </CardDescription>
          </div>
          <div className="hidden rounded-xl border border-indigo-500/30 bg-indigo-500/20 p-2 text-indigo-400 sm:block">
            <FileUp className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Label htmlFor="pdf" className="text-sm font-semibold text-slate-300">
              Document File
            </Label>
            {file ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                {file.name}
              </span>
            ) : null}
          </div>
          <Input
            ref={fileInputRef}
            id="pdf"
            type="file"
            accept=".pdf,.docx,.xlsx,.csv"
            disabled={isUploading}
            className="h-11 bg-white/5 border-white/10 text-white file:text-white file:border-0 file:bg-transparent file:font-medium focus-visible:ring-indigo-500 disabled:opacity-60"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
              setSuccess(null);
              if (!isUploading) {
                setStep(null);
                setProgress(0);
                setStepMessage(null);
              }
            }}
          />
        </div>

        {step ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="grid grid-cols-3 gap-2">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isDone =
                  step === "completed" ||
                  (activeStageIndex > idx &&
                    step !== "failed" &&
                    step !== "cancelled");
                const isCurrent =
                  step === stage.key &&
                  step !== "failed" &&
                  step !== "cancelled";

                return (
                  <div
                    key={stage.key}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors ${
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
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  {stepMessage || "Processing document..."}
                </span>
                <span className="font-mono font-semibold text-slate-300">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full transition-all duration-300 ${
                    step === "failed"
                      ? "bg-red-500"
                      : step === "cancelled"
                      ? "bg-amber-500"
                      : step === "completed"
                      ? "bg-emerald-500"
                      : "bg-indigo-500"
                  }`}
                  style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
                />
              </div>
            </div>

            {chunksIndexed !== null || pageCount !== null ? (
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                {pageCount !== null ? <span>Pages: {pageCount}</span> : null}
                {chunksIndexed !== null ? (
                  <span>Chunks indexed: {chunksIndexed}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={onUpload}
              disabled={isUploading || !file}
              className="glass-button h-11 rounded-xl px-6 bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {step === "chunking"
                    ? "Chunking..."
                    : step === "indexing"
                    ? "Indexing..."
                    : "Uploading..."}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upload and ingest
                </>
              )}
            </Button>

            {isUploading ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelAndDelete}
                disabled={isCancelling}
                className="h-11 rounded-xl border-red-500/30 bg-red-500/10 px-4 text-red-300 hover:bg-red-500/20 hover:text-red-200"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isCancelling ? "Cancelling..." : "Cancel & Delete"}
              </Button>
            ) : null}
          </div>

          <p className="inline-flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Private bucket + per-user access policy
          </p>
        </div>

        {error ? (
          <p className="flex items-center gap-1.5 text-sm text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
        {success ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}