import { Briefcase, Plus, Folder } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { API_BASE_URL } from "@/lib/api";
import Link from "next/link";
import { CreateWorkspaceForm } from "./create-workspace-form";

export default async function WorkspacesPage() {
  const supabase = createClient();
  const [userResult, workspacesResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("workspaces")
      .select("id, name, created_at")
      .order("created_at", { ascending: false })
  ]);

  const user = userResult.data.user;
  const workspaces = workspacesResult.data || [];

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Workspaces</h1>
            <p className="mt-2 text-slate-400">Group multiple documents together and query across them.</p>
          </div>
          <CreateWorkspaceForm userId={user?.id || ""} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((ws: any) => (
            <Link key={ws.id} href={`/dashboard/workspaces/${ws.id}`}>
              <div className="glass-panel border border-white/10 rounded-2xl p-6 hover:bg-white/5 transition-colors cursor-pointer group h-full">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/30 transition-colors">
                    <Folder className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">{ws.name}</h3>
                <p className="mt-1 text-sm text-slate-400">Created {new Date(ws.created_at).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
          {workspaces.length === 0 && (
             <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-2xl">
               <Briefcase className="h-10 w-10 text-slate-600 mx-auto mb-4" />
               <p className="text-slate-400">You haven&apos;t created any workspaces yet.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
