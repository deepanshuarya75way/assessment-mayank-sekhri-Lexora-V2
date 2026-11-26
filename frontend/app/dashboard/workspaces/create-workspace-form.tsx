"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export function CreateWorkspaceForm({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setIsLoading(true);
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      
      if (!session?.access_token) return;

      const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ user_id: userId, name: name.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        setIsOpen(false);
        setName("");
        router.refresh();
        router.push(`/dashboard/workspaces/${data.workspace_id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        New Workspace
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Workspace Name..."
        className="h-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500 rounded-xl"
        onKeyDown={(e) => {
           if (e.key === "Enter") handleCreate();
           if (e.key === "Escape") setIsOpen(false);
        }}
        autoFocus
      />
      <Button 
        onClick={handleCreate}
        disabled={isLoading || !name.trim()}
        className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] min-w-[80px]"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
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
