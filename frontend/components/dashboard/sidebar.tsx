"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquareText, UploadCloud, Sparkles, Briefcase } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const isHome = pathname === "/dashboard";
  const isUpload = pathname === "/dashboard/upload";
  const isDocumentChat = pathname.startsWith("/dashboard/documents");

  return (
    <aside className="hidden w-72 border-r border-white/10 bg-black/40 p-6 backdrop-blur-xl lg:block z-10 flex-shrink-0">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/20 blur-xl rounded-full" />
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-400">Lexora</p>
        </div>
        <h2 className="text-2xl font-bold text-white relative z-10">Control Deck</h2>
        <p className="mt-1 text-sm text-slate-400 relative z-10">Hybrid RAG workspace</p>
      </div>
      
      <nav className="mt-8 space-y-2 text-sm relative z-10">
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-medium transition ${
            isHome 
            ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
            : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
          }`}
        >
          <LayoutDashboard className={`h-4 w-4 ${isHome ? "text-indigo-400" : ""}`} />
          Dashboard Home
        </Link>
        
        <Link
          href="/dashboard/upload"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-medium transition ${
            isUpload 
            ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
            : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
          }`}
        >
          <UploadCloud className={`h-4 w-4 ${isUpload ? "text-indigo-400" : ""}`} />
          Upload + Index
        </Link>

        <Link
          href="/dashboard/workspaces"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-medium transition ${
            pathname.startsWith("/dashboard/workspaces")
            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
            : "border-transparent bg-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Briefcase className={`h-4 w-4 ${pathname.startsWith("/dashboard/workspaces") ? "text-emerald-400" : ""}`} />
          Workspaces
        </Link>

        {isDocumentChat && (
          <div
            className="flex items-center gap-3 rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-3 font-medium text-cyan-300 shadow-[0_0_15px_rgba(8,145,178,0.2)] transition"
          >
            <MessageSquareText className="h-4 w-4 text-cyan-400" />
            Active Chat
          </div>
        )}
      </nav>
    </aside>
  );
}
