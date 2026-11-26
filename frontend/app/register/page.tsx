"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { signUp } from "@/app/auth/actions";
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
    <Button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all" disabled={pending}>
      {pending ? "Creating account..." : "Create account"}
    </Button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState<AuthFormState, FormData>(signUp, initialState);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
      {/* Background blobs */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2 }}
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-[100px] animate-blob" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-cyan-600/10 blur-[100px] animate-blob animation-delay-2000" 
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
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 mb-2">
              <Sparkles className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl text-white">Create your account</CardTitle>
            <CardDescription className="text-slate-400">Start using Lexora in under a minute.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input id="email" name="email" type="email" required className="bg-white/5 border-white/10 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input id="password" name="password" type="password" minLength={8} required className="bg-white/5 border-white/10 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
              </div>
              {state?.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}
              <div className="pt-2">
                <SubmitButton />
              </div>
            </form>
            <p className="mt-6 text-center text-sm text-slate-400">
              Already registered?{" "}
              <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
