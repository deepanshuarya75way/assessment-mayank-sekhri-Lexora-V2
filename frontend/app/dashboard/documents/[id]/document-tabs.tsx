"use client";

import { useState } from "react";
import { MessageSquareText, AlignLeft, Tags, Sparkles, Loader2 } from "lucide-react";
import { DocumentChatPanel } from "@/components/dashboard/document-chat-panel";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";

export function DocumentTabs({ 
  userId, 
  document, 
  initialMessages 
}: { 
  userId: string; 
  document: any; 
  initialMessages: any[]; 
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "chat">("overview");
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  const handleGenerateSummary = async () => {
    try {
      setIsGenerating(true);
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      
      if (!session?.access_token) return;

      const res = await fetch(`${API_BASE_URL}/api/v1/documents/${document.id}/summarize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === "overview"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <AlignLeft className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === "chat"
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <MessageSquareText className="h-4 w-4" />
          Chat
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel border border-white/10 rounded-3xl p-6 lg:p-8 relative overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-[60px]" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlignLeft className="h-5 w-5 text-emerald-400" />
                  Executive Summary
                </h3>
                <Button 
                  onClick={handleGenerateSummary} 
                  disabled={isGenerating}
                  variant="outline"
                  size="sm"
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {document.summary ? "Regenerate" : "Generate Summary"}
                </Button>
              </div>
              {document.summary ? (
                <div className="prose prose-invert prose-emerald max-w-none">
                  <p className="text-slate-300 leading-relaxed text-lg">{document.summary}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-2xl bg-black/20">
                  <AlignLeft className="h-10 w-10 text-slate-600 mb-3" />
                  <p className="text-slate-400">Summary is not available yet.</p>
                  <p className="text-xs text-slate-500 mt-1">If the document is still processing, please wait.</p>
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel border border-white/10 rounded-3xl p-6 lg:p-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Tags className="h-5 w-5 text-emerald-400" />
                Key Entities
              </h3>
              {document.entities && document.entities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {document.entities.map((entity: string, idx: number) => (
                    <span 
                      key={idx} 
                      className="px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              ) : (
                 <p className="text-slate-500 text-sm text-center py-8">No entities extracted.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "chat" && (
        <DocumentChatPanel userId={userId} documentId={document.id} initialMessages={initialMessages} />
      )}
    </div>
  );
}
