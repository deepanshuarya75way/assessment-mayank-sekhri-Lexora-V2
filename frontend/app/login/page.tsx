"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowLeft, KeyRound } from "lucide-react";
import { motion } from "framer-motion";

import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormState = {
  error?: string;
};

const initialState: AuthFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(8,145,178,0.3)] transition-all" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthFormState, FormData>(signIn, initialState);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {/* Background blobs */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2 }}
        className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-cyan-600/10 blur-[100px] animate-blob" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-[100px] animate-blob animation-delay-2000" 
      />
      
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-8 left-8 z-10 hidden md:block"
      >
        <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full max-w-md z-10"
      >
        <Card className="w-full h-full glass-panel border-white/10 bg-black/40">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl text-white">Welcome back</CardTitle>
            <CardDescription className="text-slate-400">Sign in to access your Lexora dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input id="email" name="email" type="email" required className="bg-white/5 border-white/10 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input id="password" name="password" type="password" required className="bg-white/5 border-white/10 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors" />
              </div>
              {state?.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}
              <div className="pt-2">
                <SubmitButton />
              </div>
            </form>
            <p className="mt-6 text-center text-sm text-slate-400">
              No account yet?{" "}
              <Link href="/register" className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
