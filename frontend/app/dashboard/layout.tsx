import Link from "next/link";
import { LayoutDashboard, MessageSquareText, UploadCloud, Sparkles } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-screen bg-background overflow-hidden">
      {/* Background blobs for subtle depth */}
      <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
      
      <Sidebar />
      <div className="flex flex-1 flex-col relative z-10">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400">Lexora</p>
              <h1 className="text-xl font-bold text-white">Hybrid Intelligence Dashboard</h1>
            </div>
            <form action={signOut}>
              <Button type="submit" className="rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
