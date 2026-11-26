"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Background blobs */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] animate-blob" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px] animate-blob animation-delay-2000" 
      />
      
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute top-0 z-50 w-full p-6"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Lexora</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link 
              href="/register" 
              className="glass-button rounded-full px-5 py-2 text-sm font-medium text-white flex items-center gap-2"
            >
              Get Started
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 text-center z-10"
      >
        <motion.div variants={itemVariants}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-indigo-300 backdrop-blur-md mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Lexora 2.0 is live
          </div>
        </motion.div>
        
        <motion.h1 
          variants={itemVariants}
          className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-7xl"
        >
          Understand complex <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">documents in minutes</span>
        </motion.h1>
        
        <motion.p 
          variants={itemVariants}
          className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl"
        >
          Upload legal, research, and business PDFs. Get instant AI insights and collaborate with confidence through advanced Hybrid RAG technology.
        </motion.p>
        
        <motion.div 
          variants={itemVariants}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/register"
              className="group relative inline-flex h-12 items-center justify-center gap-2 rounded-full bg-indigo-500 px-8 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all hover:bg-indigo-400 hover:shadow-[0_0_30px_rgba(99,102,241,0.6)]"
            >
              Start Analyzing Now
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="#features"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 text-sm font-medium text-slate-300 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
            >
              View Features
            </Link>
          </motion.div>
        </motion.div>

        {/* Floating Mockup / Interface Hint */}
        <motion.div 
          variants={itemVariants}
          className="mt-20 w-full max-w-5xl rounded-2xl p-1 bg-gradient-to-b from-white/10 to-transparent shadow-2xl" id="features"
        >
          <div className="glass-panel overflow-hidden rounded-xl bg-slate-900/60 flex flex-col border border-white/10">
            <div className="border-b border-white/5 bg-white/5 px-4 py-3 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500/80"></div>
              <div className="h-3 w-3 rounded-full bg-amber-500/80"></div>
              <div className="h-3 w-3 rounded-full bg-emerald-500/80"></div>
            </div>
            <div className="grid sm:grid-cols-3 p-8 gap-8 text-left bg-black/20">
              <motion.div whileHover={{ y: -5 }} className="space-y-3 transition-transform">
                <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white">Hybrid Indexing</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Combines semantic search and keyword matching for unparalleled accuracy.</p>
              </motion.div>
              <motion.div whileHover={{ y: -5 }} className="space-y-3 transition-transform">
                <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white">Generative Insights</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Powered by Gemini 1.5 Flash to synthesize comprehensive answers from your documents.</p>
              </motion.div>
              <motion.div whileHover={{ y: -5 }} className="space-y-3 transition-transform">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white">Secure Workspace</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Enterprise-grade security using Supabase Row-Level Security for strict privacy.</p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.section>
    </main>
  );
}
