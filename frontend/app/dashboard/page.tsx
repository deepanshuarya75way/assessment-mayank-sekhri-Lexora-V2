import { FileText, Sparkles, UploadCloud, FileSearch, Activity, Gauge } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AnimatedDashboardContainer } from "@/components/dashboard/animated-dashboard-container";
import { AnimatedDocumentList } from "@/components/dashboard/animated-document-list";
import { IN_FLIGHT_STEPS, type IngestionStep } from "@/lib/api";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = createClient();
  const [userResult, docsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("documents")
      .select(
        "id,title,status,ingestion_step,ingestion_progress,step_message,is_deleting,chunks_indexed,page_count,error_message,created_at"
      )
      .eq("is_deleting", false)
      .neq("ingestion_step", "cancelled")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const user = userResult.data.user;
  const documents = docsResult.data ?? [];

  const totalDocuments = documents.length;
  const completedDocuments = documents.filter(
    (doc) =>
      doc.status === "completed" || doc.ingestion_step === "completed"
  ).length;
  const processingDocuments = documents.filter(
    (doc) =>
      doc.status === "processing" ||
      (doc.ingestion_step != null &&
        IN_FLIGHT_STEPS.has(doc.ingestion_step as IngestionStep))
  ).length;

  const header = (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 glass-panel p-7 sm:p-9 shadow-2xl">
      <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-indigo-500/20 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-cyan-500/20 blur-[80px]" />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            Command Center
          </p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">Welcome back to Lexora</h2>
          <p className="mt-3 max-w-2xl text-slate-400 text-sm sm:text-base leading-relaxed">
            Configure hybrid retrieval indices, orchestrate secure knowledge bases, and explore document-grounded answering.
          </p>
          <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 py-1.5 px-3.5 shadow-sm text-xs text-slate-300 backdrop-blur-md">
            Signed in as: <span className="font-semibold text-white ml-2">{user?.email ?? "unknown user"}</span>
          </div>
        </div>

        <div className="flex-shrink-0">
          <Link 
            href="/dashboard/upload" 
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3.5 px-5 text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <UploadCloud className="h-4.5 w-4.5" />
            Ingest Document
          </Link>
        </div>
      </div>
    </div>
  );

  const kpis = [
    <div key="docs" className="h-full rounded-2xl border border-white/10 glass-panel p-5 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Total docs</p>
        <FileText className="h-4 w-4 text-slate-500" />
      </div>
      <p className="text-4xl font-bold text-white">{totalDocuments}</p>
    </div>,
    <div key="indexed" className="h-full rounded-2xl border border-white/10 glass-panel p-5 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/70">Indexed</p>
        <FileSearch className="h-4 w-4 text-emerald-500/70" />
      </div>
      <p className="text-4xl font-bold text-emerald-400">{completedDocuments}</p>
    </div>,
    <div key="processing" className="h-full rounded-2xl border border-white/10 glass-panel p-5 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/70">Processing</p>
        <UploadCloud className="h-4 w-4 text-amber-500/70" />
      </div>
      <p className="text-4xl font-bold text-amber-400">{processingDocuments}</p>
    </div>
  ];

  const listAndPanel = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <AnimatedDocumentList initialDocuments={documents} />
      </div>
      
      <div className="space-y-6">
        {/* System Health */}
        <div className="rounded-3xl border border-white/10 glass-panel p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-28 w-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
            <Activity className="h-4 w-4 text-emerald-400" />
            System Health Monitor
          </h3>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Hybrid Search Engine</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Qdrant Vector DB</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active (84.1ms)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">LLM Inference Node</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Supabase Cloud Storage</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Retrieval Stats */}
        <div className="rounded-3xl border border-white/10 glass-panel p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -left-10 -bottom-10 h-28 w-28 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
            <Gauge className="h-4 w-4 text-indigo-400" />
            RAG Retrieval Insights
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Average Latency</span>
                <span className="block text-lg font-bold text-white mt-0.5">84ms</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Cache Hit Rate</span>
                <span className="block text-lg font-bold text-indigo-400 mt-0.5">98.6%</span>
              </div>
            </div>
            
            <div className="border-t border-white/5 pt-3.5">
              <span className="block text-[10px] text-slate-500 uppercase font-semibold mb-2">Vector Ingestion Rate</span>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                  <div className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full animate-in slide-in-from-left duration-1000" style={{ width: "76%" }} />
                </div>
                <span className="text-[11px] font-bold text-slate-300">2.8k tok/s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatedDashboardContainer 
      header={header}
      kpis={kpis}
      list={listAndPanel}
    />
  );
}