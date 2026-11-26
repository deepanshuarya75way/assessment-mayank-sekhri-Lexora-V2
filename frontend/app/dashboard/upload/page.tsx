"use client";

import { useState } from "react";
import { UploadPdfCard } from "@/components/dashboard/upload-pdf-card";
import { 
  Sparkles, 
  Settings2, 
  Database, 
  Activity, 
  Cpu, 
  Compass, 
  FileText,
  Sliders,
  Flame,
  LayoutGrid
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function UploadPage() {
  const [chunkSize, setChunkSize] = useState(1000);
  const [overlap, setOverlap] = useState(150);
  const [strategy, setStrategy] = useState("recursive");
  const [ocrEnabled, setOcrEnabled] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <motion.div 
      className="w-full space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header section */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-white/10 glass-panel p-7 sm:p-9 shadow-2xl">
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-emerald-500/10 blur-[80px]" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              Ingestion Workspace
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">Document Ingestion Pipeline</h2>
            <p className="mt-3 max-w-2xl text-slate-400 text-sm sm:text-base">
              Upload documents to chunk, embed, and index them into Qdrant vector storage. Configure indexing strategies below to customize retrieval behavior.
            </p>
          </div>
          
          <Link href="/dashboard" className="self-start sm:self-center inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium py-2.5 px-4 text-sm transition duration-200">
            <LayoutGrid className="h-4 w-4 text-indigo-400" />
            Back to Deck
          </Link>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Upload Zone & Pipeline Stepper */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Upload Card */}
          <UploadPdfCard />

          {/* Ingestion Stepper Info */}
          <div className="rounded-3xl border border-white/10 glass-panel p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -left-10 -bottom-10 h-40 w-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <Activity className="h-5 w-5 text-indigo-400" />
              Automated Ingestion Pipeline Stages
            </h3>
            
            <div className="relative border-l-2 border-white/10 ml-3 space-y-8 pl-8">
              {/* Stage 1 */}
              <div className="relative">
                <div className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white ring-8 ring-black/40 shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Document Parsing & Layout Extraction</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Automatically extracts structural metadata, table configurations, and text fields. Formats raw PDFs, CSVs, or DOCX files for semantic tokenization.
                  </p>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="relative">
                <div className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 ring-8 ring-black/40">
                  2
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Semantic Chunking & Text Splitting</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Uses active paragraph boundaries and overlapping limits configured in your settings card to chunk text cleanly, ensuring context is preserved across fragment edges.
                  </p>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="relative">
                <div className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 ring-8 ring-black/40">
                  3
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Hybrid Vector Encoding</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Sends chunk data to generative embedders, creating sparse lexical models and dense semantic vectors simultaneously for comprehensive hybrid search.
                  </p>
                </div>
              </div>

              {/* Stage 4 */}
              <div className="relative">
                <div className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 ring-8 ring-black/40">
                  4
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Qdrant Storage & Activation</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Stores encoded vectors under active user authorization limits, enabling lightning-fast, secure retrieval directly in document chat workspaces.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Advanced Settings & Health Widgets */}
        <div className="space-y-6">
          {/* Ingestion Settings Card */}
          <div className="rounded-3xl border border-white/10 glass-panel p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
              <Settings2 className="h-5 w-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">RAG Configuration</h3>
            </div>

            <div className="space-y-6">
              {/* Chunk Size */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider">Chunk Size</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{chunkSize} chars</span>
                </div>
                <input 
                  type="range" 
                  min="200" 
                  max="2000" 
                  step="50" 
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <p className="text-[10px] text-slate-400">Controls size of text fragments sent to the embedding model.</p>
              </div>

              {/* Overlap */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider">Overlap Limit</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{overlap} chars</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="500" 
                  step="10" 
                  value={overlap}
                  onChange={(e) => setOverlap(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <p className="text-[10px] text-slate-400">Preserves context continuity across consecutive chunks.</p>
              </div>

              {/* Parser Strategy */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Parser Strategy</label>
                <select 
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="recursive" className="bg-slate-900 text-white">Recursive Character Splitting</option>
                  <option value="semantic" className="bg-slate-900 text-white">Semantic AI Chunking (Gpt-4o)</option>
                  <option value="regex" className="bg-slate-900 text-white">Markdown Header Splitter</option>
                </select>
                <p className="text-[10px] text-slate-400">Determines algorithm used to structure split points.</p>
              </div>

              {/* OCR Toggle */}
              <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-2">
                <div>
                  <span className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Force OCR parsing</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Scans handwritten text/scanned docs.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={ocrEnabled}
                    onChange={(e) => setOcrEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Embedding Model */}
              <div className="border-t border-white/10 pt-4 space-y-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Embedding Model</label>
                <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/5 p-3 text-slate-400 text-xs">
                  <Cpu className="h-4 w-4 text-slate-500" />
                  <span>lexora-hybrid-v1 (Dense+Sparse)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Database Health Card */}
          <div className="rounded-3xl border border-white/10 glass-panel p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -left-10 -bottom-10 h-24 w-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Database Health Status</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Vector Storage Host</span>
                <span className="text-white font-mono font-medium text-[11px]">Qdrant-cloud-us-east</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Ingestion Inbound Rate</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5" /> Normal (0/s)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Storage capacity</span>
                <span className="text-white font-semibold">99.8% free</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
