"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type Doc = { id: string; title: string };

export function AddDocumentToWorkspace({ workspaceId, userId, availableDocs }: { workspaceId: string, userId: string, availableDocs: Doc[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleAdd = async () => {
    if (!selectedDoc) return;
    try {
      setIsLoading(true);
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      
      if (!session?.access_token) return;

      const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ user_id: userId, document_id: selectedDoc })
      });

      if (res.ok) {
        setIsOpen(false);
        setSelectedDoc("");
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (availableDocs.length === 0) {
    return <p className="text-sm text-slate-500">No more documents available to add.</p>;
  }

  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Document
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
      <select
        value={selectedDoc}
        onChange={(e) => setSelectedDoc(e.target.value)}
        className="h-10 bg-white/5 border border-white/10 text-white focus:ring-emerald-500 rounded-xl px-3 outline-none min-w-[200px]"
      >
        <option value="" className="bg-slate-900 text-slate-400">Select a document...</option>
        {availableDocs.map(d => (
          <option key={d.id} value={d.id} className="bg-slate-900 text-white">{d.title}</option>
        ))}
      </select>

      <Button 
        onClick={handleAdd}
        disabled={isLoading || !selectedDoc}
        className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] min-w-[80px]"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
      </Button>
      <Button 
        variant="ghost" 
        onClick={() => setIsOpen(false)}
        className="text-slate-400 hover:text-white rounded-xl"
      >
        Cancel
      </Button>
    </div>
  );
}
