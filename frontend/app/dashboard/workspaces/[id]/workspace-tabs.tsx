"use client";

import { useState } from "react";
import { MessageSquareText, AlignLeft, Tags, Sparkles, Loader2, FileText } from "lucide-react";
import { DocumentChatPanel } from "@/components/dashboard/document-chat-panel";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";
import { RemoveDocumentButton } from "./remove-document-button";

export function WorkspaceTabs({ 
  userId, 
  workspace, 
  initialMessages,
  workspaceDocuments
}: { 
  userId: string; 
  workspace: any; 
  initialMessages: any[]; 
  workspaceDocuments: any[];
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

      const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspace.id}/summarize?user_id=${userId}`, {
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 mt-8">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel border border-white/10 rounded-3xl p-6 lg:p-8 relative overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-[60px]" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlignLeft className="h-5 w-5 text-emerald-400" />
                  Workspace Summary
                </h3>
                <Button 
                  onClick={handleGenerateSummary} 
                  disabled={isGenerating || workspaceDocuments.length === 0}
                  variant="outline"
                  size="sm"
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {workspace.summary ? "Regenerate" : "Generate Summary"}
                </Button>
              </div>
              {workspace.summary ? (
                <div className="prose prose-invert prose-emerald max-w-none">
                  <p className="text-slate-300 leading-relaxed text-lg">{workspace.summary}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-2xl bg-black/20">
                  <AlignLeft className="h-10 w-10 text-slate-600 mb-3" />
                  <p className="text-slate-400">Workspace summary is not available yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Add documents and click Generate Summary.</p>
                </div>
              )}
            </div>

            <div className="glass-panel border border-white/10 rounded-3xl p-6 lg:p-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Tags className="h-5 w-5 text-emerald-400" />
                Key Entities
              </h3>
              {workspace.entities && workspace.entities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {workspace.entities.map((entity: string, idx: number) => (
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

          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel border border-white/10 rounded-3xl p-6">
               <h3 className="text-lg font-semibold text-white mb-4">Documents ({workspaceDocuments.length})</h3>
               <div className="space-y-3">
                 {workspaceDocuments.map((doc: any) => (
                   <div key={doc.id} className="flex flex-col gap-2 p-4 rounded-xl bg-white/5 border border-white/5 group relative hover:bg-white/10 transition-colors">
                     <div className="flex items-start justify-between gap-3">
                       <div className="flex items-center gap-3">
                         <FileText className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                         <span className="text-sm font-medium text-slate-200">{doc.title}</span>
                       </div>
                       <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                         <RemoveDocumentButton workspaceId={workspace.id} documentId={doc.id} userId={userId} />
                       </div>
                     </div>
                     {doc.summary ? (
                       <p className="text-xs text-slate-400 line-clamp-2 pl-7">{doc.summary}</p>
                     ) : (
                       <p className="text-xs text-slate-500 pl-7 italic">No summary generated.</p>
                     )}
                   </div>
                 ))}
                 {workspaceDocuments.length === 0 && (
                   <p className="text-sm text-slate-500 text-center py-4">No documents added yet.</p>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "chat" && (
        <DocumentChatPanel userId={userId} workspaceId={workspace.id} initialMessages={initialMessages} />
      )}
    </div>
  );
}
