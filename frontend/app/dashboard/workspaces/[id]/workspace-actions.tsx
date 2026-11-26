"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Edit2, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export function WorkspaceActions({ workspaceId, userId, initialName }: { workspaceId: string; userId: string; initialName: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleRename = async () => {
    if (!name.trim() || name === initialName) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      
      if (!session?.access_token) return;

      const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ user_id: userId, name: name.trim() })
      });

      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this workspace? This action cannot be undone.")) return;
    try {
      setIsDeleting(true);
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      
      if (!session?.access_token) return;

      const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}?user_id=${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (res.ok) {
        router.push("/dashboard/workspaces");
      }
    } catch (e) {
      console.error(e);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 bg-white/5 border-white/10 text-white rounded-lg w-48"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setName(initialName);
                setIsEditing(false);
              }
            }}
          />
          <Button size="sm" onClick={handleRename} disabled={isSaving} className="h-9 w-9 bg-emerald-500 hover:bg-emerald-400 text-white">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setName(initialName); setIsEditing(false); }} className="h-9 w-9 text-slate-400">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-white">{name}</h1>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="h-8 w-8 text-slate-400 hover:text-white">
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      
      {!isEditing && (
        <Button variant="ghost" onClick={handleDelete} disabled={isDeleting} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
          Delete
        </Button>
      )}
    </div>
  );
}
