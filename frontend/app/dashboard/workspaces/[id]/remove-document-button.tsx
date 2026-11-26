"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export function RemoveDocumentButton({ workspaceId, documentId, userId }: { workspaceId: string; documentId: string; userId: string }) {
  const [isRemoving, setIsRemoving] = useState(false);
  const router = useRouter();

  const handleRemove = async () => {
    try {
      setIsRemoving(true);
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      
      if (!session?.access_token) return;

      const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/documents/${documentId}?user_id=${userId}`, {
        method: "DELETE",
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
      setIsRemoving(false);
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleRemove} 
      disabled={isRemoving}
      className="h-8 w-8 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto flex-shrink-0"
    >
      {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
    </Button>
  );
}
