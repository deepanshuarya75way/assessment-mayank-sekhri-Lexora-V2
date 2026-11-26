"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  FileText,
  Loader2,
  Highlighter,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type ActiveCitation = {
  documentId: string;
  pageNumber: number;
  chunkText: string;
};

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function buildHighlightPhrases(chunkText: string): string[] {
  const normalized = normalizeText(chunkText);
  if (!normalized) return [];

  const segments = normalized
    .split(/(?<=[.!?;:])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  return segments.length > 0 ? segments : [normalized];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function PdfPreviewPanel({
  citation,
  onClose,
}: {
  citation: ActiveCitation;
  onClose: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState<string>("Document Preview");
  const [numPages, setNumPages] = useState<number>(0);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.05);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isGlowing, setIsGlowing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const loadedDocIdRef = useRef<string | null>(null);
  const hasScrolledForCitationRef = useRef<string>("");

  const citationKey = `${citation.documentId}:${citation.pageNumber}:${citation.chunkText.slice(0, 40)}`;

  const handleCopyExcerpt = async () => {
    try {
      await navigator.clipboard.writeText(citation.chunkText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy excerpt:", err);
    }
  };

  useEffect(() => {
    setCopied(false);
  }, [citationKey]);

  // Fetch signed URL whenever the cited document changes
  useEffect(() => {
    let cancelled = false;

    const loadPreviewUrl = async () => {
      if (loadedDocIdRef.current === citation.documentId && pdfUrl) {
        return;
      }

      try {
        setIsLoadingUrl(true);
        setError(null);
        setNumPages(0);

        const client = createClient();
        const {
          data: { session },
        } = await client.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        const res = await fetch(
          `${API_BASE_URL}/api/v1/documents/${citation.documentId}/preview-url`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(payload?.detail || "Unable to load document preview");
        }

        const data = await res.json();
        if (!cancelled) {
          loadedDocIdRef.current = citation.documentId;
          setPdfUrl(data.url);
          setDocTitle(data.title || "Document Preview");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUrl(false);
        }
      }
    };

    void loadPreviewUrl();
    return () => {
      cancelled = true;
    };
  }, [citation.documentId, pdfUrl]);

  // Smoothly scroll to the target page & excerpt, and trigger the temporary glow on open
  const scrollToExcerpt = useCallback(
    (targetPage: number) => {
      const pageEl = pageRefs.current[targetPage];
      if (!pageEl) return;

      const firstMark = pageEl.querySelector("mark.citation-mark");
      if (firstMark) {
        firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
        hasScrolledForCitationRef.current = citationKey;
      } else {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [citationKey]
  );

  useEffect(() => {
    hasScrolledForCitationRef.current = "";
    setIsGlowing(true);

    const glowTimer = window.setTimeout(() => {
      setIsGlowing(false);
    }, 2800);

    const scrollTimer = window.setTimeout(() => {
      if (numPages > 0) {
        const clampedPage = Math.min(Math.max(1, citation.pageNumber || 1), numPages);
        scrollToExcerpt(clampedPage);
      }
    }, 180);

    return () => {
      window.clearTimeout(glowTimer);
      window.clearTimeout(scrollTimer);
    };
  }, [citationKey, citation.pageNumber, numPages, scrollToExcerpt]);

  // Track currently visible page while scrolling
  useEffect(() => {
    const root = viewportRef.current;
    if (!root || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage = visiblePage;
        let maxRatio = 0;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            const pageAttr = Number(entry.target.getAttribute("data-page-number"));
            if (pageAttr) {
              maxRatio = entry.intersectionRatio;
              bestPage = pageAttr;
            }
          }
        }

        if (maxRatio > 0) {
          setVisiblePage(bestPage);
        }
      },
      { root, threshold: [0.2, 0.5, 0.8] }
    );

    for (let i = 1; i <= numPages; i++) {
      const el = pageRefs.current[i];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [numPages, visiblePage]);

  const highlightPhrases = useMemo(
    () => buildHighlightPhrases(citation.chunkText),
    [citation.chunkText]
  );

  const fullNormalizedChunk = useMemo(
    () => normalizeText(citation.chunkText),
    [citation.chunkText]
  );

  const makeTextRenderer = useCallback(
    (pageNumber: number) => (textItem: { str: string }) => {
      const raw = textItem.str;
      const safeRaw = escapeHtml(raw);
      if (pageNumber !== citation.pageNumber) return safeRaw;

      const normSpan = normalizeText(raw);
      if (normSpan.length < 4) return safeRaw;

      const isMatch =
        fullNormalizedChunk.includes(normSpan) ||
        highlightPhrases.some(
          (phrase) => phrase.includes(normSpan) || normSpan.includes(phrase)
        );

      if (isMatch) {
        return `<mark class="citation-mark">${safeRaw}</mark>`;
      }

      return safeRaw;
    },
    [citation.pageNumber, fullNormalizedChunk, highlightPhrases]
  );

  const handleTargetTextLayerSuccess = useCallback(
    (pageNumber: number) => {
      if (
        pageNumber === citation.pageNumber &&
        hasScrolledForCitationRef.current !== citationKey
      ) {
        requestAnimationFrame(() => {
          scrollToExcerpt(pageNumber);
        });
      }
    },
    [citation.pageNumber, citationKey, scrollToExcerpt]
  );

  const jumpToPage = (target: number) => {
    const clamped = Math.min(Math.max(1, target), numPages || 1);
    setVisiblePage(clamped);
    pageRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="rounded-3xl border border-white/10 glass-panel shadow-2xl flex flex-col h-[700px] overflow-hidden bg-slate-950/80">
      <style>{`
        mark.citation-mark {
          background-color: rgba(252, 211, 77, 0.78);
          color: #020617;
          border-radius: 3px;
          padding: 0 2px;
          transition: box-shadow 0.6s ease, background-color 0.6s ease;
        }

        .citation-glow-active mark.citation-mark {
          background-color: rgba(253, 224, 71, 0.95);
          animation: citationGlowPulse 1.3s ease-in-out 2;
        }

        @keyframes citationGlowPulse {
          0%, 100% {
            box-shadow: 0 0 8px 2px rgba(251, 191, 36, 0.65),
                        0 0 18px 4px rgba(34, 211, 238, 0.45);
          }
          50% {
            box-shadow: 0 0 14px 5px rgba(251, 191, 36, 0.95),
                        0 0 28px 10px rgba(34, 211, 238, 0.8);
          }
        }
      `}</style>

      {/* Header Toolbar */}
      <div className="border-b border-white/10 px-4 py-3 bg-black/40 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-white truncate">{docTitle}</h4>
            <button
              type="button"
              onClick={() => scrollToExcerpt(citation.pageNumber)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              title="Scroll to cited excerpt"
            >
              <Highlighter className="h-3 w-3" />
              Cited on Page {citation.pageNumber}
            </button>
          </div>
        </div>

        {/* Pagination, Zoom & Close */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg px-1.5 py-0.5 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => jumpToPage(visiblePage - 1)}
              disabled={visiblePage <= 1}
              className="p-1 hover:text-white disabled:opacity-30"
              title="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px]">
              {visiblePage} / {numPages || "–"}
            </span>
            <button
              type="button"
              onClick={() => jumpToPage(visiblePage + 1)}
              disabled={numPages > 0 && visiblePage >= numPages}
              className="p-1 hover:text-white disabled:opacity-30"
              title="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.6, +(s - 0.15).toFixed(2)))}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.min(2.2, +(s + 0.15).toFixed(2)))}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 ml-1"
            title="Close preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cited Excerpt Banner with One-Click Copy */}
      <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-200/90 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-start gap-2 min-w-0">
          <span className="font-semibold text-amber-400 shrink-0 uppercase tracking-wider text-[10px] mt-0.5">
            Excerpt:
          </span>
          <p className="line-clamp-2 italic text-slate-300">&ldquo;{citation.chunkText}&rdquo;</p>
        </div>

        <button
          type="button"
          onClick={() => void handleCopyExcerpt()}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-400/20 hover:text-white transition-colors"
          title="Copy cited excerpt"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-300">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Continuous Scroll PDF Viewport */}
      <div
        ref={viewportRef}
        className="flex-1 overflow-auto p-4 flex flex-col items-center bg-black/30 scroll-smooth"
      >
        {isLoadingUrl ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            <span className="text-xs">Loading document...</span>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-rose-400 text-sm px-6 text-center">
            {error}
          </div>
        ) : pdfUrl ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: total }) => {
              setNumPages(total);
              setVisiblePage(1);
            }}
            loading={
              <div className="py-20 flex items-center gap-2 text-slate-400 text-xs">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                Rendering PDF...
              </div>
            }
            error={
              <div className="py-20 text-rose-400 text-xs">
                Could not render this PDF file.
              </div>
            }
          >
            <div className="flex flex-col gap-4 items-center">
              {Array.from({ length: numPages }, (_, index) => {
                const pageNum = index + 1;
                const isTargetPage = pageNum === citation.pageNumber;

                return (
                  <div
                    key={`${citation.documentId}-page-${pageNum}`}
                    ref={(el) => {
                      pageRefs.current[pageNum] = el;
                    }}
                    data-page-number={pageNum}
                    className={isTargetPage && isGlowing ? "citation-glow-active" : ""}
                  >
                    <Page
                      pageNumber={pageNum}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      customTextRenderer={makeTextRenderer(pageNum)}
                      onRenderTextLayerSuccess={() => handleTargetTextLayerSuccess(pageNum)}
                      className="shadow-2xl rounded-lg overflow-hidden"
                    />
                  </div>
                );
              })}
            </div>
          </Document>
        ) : null}
      </div>
    </div>
  );
}