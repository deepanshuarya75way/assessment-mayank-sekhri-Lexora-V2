"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Bot, 
  SendHorizontal, 
  Sparkles, 
  User, 
  Loader2, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  MessageSquare, 
  Menu 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { PromptTemplates } from "@/components/chat/prompt-templates";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
};

type SourceCitation = {
  page_number: number;
  chunk_text: string;
  score: number;
};

type AssistantTurn = ChatMessage & {
  sources?: SourceCitation[];
};

type ChatAskResponse = {
  answer: string;
  sources: SourceCitation[];
};

export function DocumentChatPanel({
  userId,
  documentId,
  workspaceId,
  initialMessages
}: {
  userId: string;
  documentId?: string;
  workspaceId?: string;
  initialMessages: ChatMessage[];
}) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isRenamingSessionId, setIsRenamingSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [messages, setMessages] = useState<AssistantTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Fetch all chat sessions for this doc/workspace
  const fetchSessions = async (autoCreate = true) => {
    try {
      setIsLoadingSessions(true);
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) return;

      const paramsObj = new URLSearchParams();
      paramsObj.append("user_id", userId);
      if (documentId) paramsObj.append("document_id", documentId);
      if (workspaceId) paramsObj.append("workspace_id", workspaceId);

      const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions?${paramsObj.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0) {
          setActiveSessionId(data[0].id);
        } else if (autoCreate) {
          await handleCreateSession(data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    void fetchSessions();
  }, [documentId, workspaceId]);

  // Load messages whenever active session changes
  useEffect(() => {
    const fetchSessionMessages = async () => {
      if (!activeSessionId) {
        setMessages([]);
        return;
      }
      try {
        const client = createClient();
        const { data, error } = await client
          .from("chat_messages")
          .select("*")
          .eq("session_id", activeSessionId)
          .order("created_at", { ascending: true });
        
        if (!error && data) {
          setMessages(data.map((m: any) => ({
            role: m.role,
            content: m.content
          })));
        }
      } catch (e) {
        console.error(e);
      }
    };
    void fetchSessionMessages();
  }, [activeSessionId]);

  const handleCreateSession = async (currentSessions?: any[]) => {
    try {
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) return;

      const list = currentSessions ?? sessions;

      const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_id: userId,
          document_id: documentId,
          workspace_id: workspaceId,
          title: `Chat ${list.length + 1}`
        })
      });
      if (res.ok) {
        const newSess = await res.json();
        setSessions((prev) => [newSess, ...prev]);
        setActiveSessionId(newSess.id);
        return newSess;
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRenameSession = async (sessionId: string) => {
    if (!renameTitle.trim()) return;
    try {
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_id: userId,
          title: renameTitle.trim()
        })
      });
      if (res.ok) {
        setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title: renameTitle.trim() } : s));
        setIsRenamingSessionId(null);
        setRenameTitle("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;
    try {
      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}?user_id=${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          if (remaining.length > 0) {
            setActiveSessionId(remaining[0].id);
          } else {
            setActiveSessionId(null);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const askQuestion = async (overrideQuestion?: string) => {
    const q = (overrideQuestion ?? question).trim();
    if (!q) {
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const client = createClient();
      const {
        data: { session }
      } = await client.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Ensure active session exists, else create one
      let currentSessionId = activeSessionId;
      if (!currentSessionId) {
        const newSess = await handleCreateSession();
        if (!newSess) throw new Error("Could not create chat session");
        currentSessionId = newSess.id;
      }

      const userMessage: AssistantTurn = { role: "user", content: q };
      setMessages((prev) => [...prev, userMessage]);
      setQuestion("");

      const response = await fetch(`${API_BASE_URL}/api/v1/chat/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_id: userId,
          document_id: documentId,
          workspace_id: workspaceId,
          question: q,
          alpha: 0.5,
          top_k: 8,
          session_id: currentSessionId
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || "Chat request failed");
      }

      const data = (await response.json()) as ChatAskResponse;
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected chat error");
    } finally {
      setIsLoading(false);
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <Card className="rounded-3xl border border-white/10 glass-panel shadow-2xl relative overflow-hidden flex flex-col md:flex-row h-[700px]">
      {/* Background radial highlight */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      {/* Sidebar: Chat sessions list */}
      {isSidebarOpen && (
        <div className="w-full md:w-64 border-r border-white/10 bg-black/40 flex flex-col h-1/3 md:h-full relative z-20 shrink-0">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold text-white/90 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              Chat History
            </span>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => void handleCreateSession()} 
              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingSessions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => setActiveSessionId(sess.id)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                    activeSessionId === sess.id
                      ? "bg-indigo-500/10 border-indigo-500/30 text-white"
                      : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className="h-4 w-4 shrink-0 text-indigo-400/70" />
                    {isRenamingSessionId === sess.id ? (
                      <input
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        className="bg-black/40 border border-white/20 text-white text-xs rounded px-1.5 py-0.5 focus:outline-none w-full"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRenameSession(sess.id);
                          if (e.key === "Escape") setIsRenamingSessionId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-xs truncate font-medium">{sess.title}</span>
                    )}
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 pl-1 transition-opacity">
                    {isRenamingSessionId === sess.id ? (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); void handleRenameSession(sess.id); }}
                          className="p-1 hover:text-emerald-400 rounded transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsRenamingSessionId(null); }}
                          className="p-1 hover:text-rose-400 rounded transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsRenamingSessionId(sess.id);
                            setRenameTitle(sess.title);
                          }}
                          className="p-1 hover:text-indigo-400 rounded transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={(e) => void handleDeleteSession(sess.id, e)}
                          className="p-1 hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col h-2/3 md:h-full relative z-10">
        <div className="border-b border-white/10 p-4 md:p-6 flex items-center justify-between bg-black/20 shrink-0">
          <div className="flex items-center gap-3">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="h-9 w-9 p-0 text-slate-400 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <CardTitle className="text-xl text-white">
                {activeSession ? activeSession.title : "Document Analyst"}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 hidden sm:block">
                Hybrid vector & sparse search with LLM generation
              </CardDescription>
            </div>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth bg-black/10"
        >
          <AnimatePresence initial={false}>
            {messages.length ? (
              messages.map((message, idx) => (
                <motion.div 
                  key={`${message.role}-${idx}`} 
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="space-y-2 flex flex-col"
                >
                  <div
                    className={
                      message.role === "user"
                        ? "self-end max-w-[90%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-3 text-sm text-white shadow-lg sm:max-w-[75%]"
                        : "self-start max-w-[90%] rounded-2xl rounded-tl-sm border border-white/10 glass-panel px-5 py-3 text-sm text-slate-200 shadow-lg sm:max-w-[85%]"
                    }
                  >
                    <p className={`mb-1.5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold ${message.role === 'user' ? 'text-white/70' : 'text-indigo-400'}`}>
                      {message.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      {message.role}
                    </p>
                    <div className="leading-relaxed prose prose-invert prose-sm max-w-none text-slate-200">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Sources Blocks */}
                  {message.role === "assistant" && message.sources?.length ? (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ delay: 0.2 }}
                      className="self-start max-w-[90%] sm:max-w-[85%] space-y-3 mt-2"
                    >
                      <div className="flex items-center gap-2 px-2">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Generative Sources</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {message.sources.slice(0, 4).map((source, sourceIndex) => (
                          <div 
                            key={`${idx}-${sourceIndex}`} 
                            className="rounded-xl border border-white/5 bg-white/5 transition hover:bg-white/10 hover:border-white/10 p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="inline-flex items-center rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                                Page {source.page_number}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                REL {(source.score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-400 line-clamp-3">&quot;{source.chunk_text}&quot;</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center px-4"
              >
                <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-indigo-400" />
                </div>
                <p className="text-lg font-semibold text-white">AI Ready to Assist</p>
                <p className="mt-2 text-sm text-slate-400 max-w-sm">
                  I&apos;ve read the context and its vectors are loaded. Ask me to extract obligations, summarize dates, or find hidden clauses.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="self-start max-w-[90%] rounded-2xl rounded-tl-sm border border-white/10 glass-panel px-5 py-4 text-sm text-slate-400 shadow-lg flex items-center gap-3"
            >
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              Scanning hybrid sparse/dense indexes...
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-black/40 shrink-0">
          <div className="flex flex-col gap-3 relative">
            {error ? <p className="text-xs text-rose-400 font-medium px-2">{error}</p> : null}
            {messages.length === 0 && !isLoading ? <PromptTemplates onSelect={(prompt) => askQuestion(prompt)} /> : null}
            <div className="relative flex items-center gap-3">
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask your document anything..."
                className="h-14 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500 focus-visible:ring-offset-0 px-5 pr-14 transition-all"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void askQuestion();
                  }
                }}
              />
              <Button 
                type="button" 
                onClick={() => void askQuestion()} 
                disabled={isLoading || !question.trim()} 
                size="sm"
                className="absolute right-2 h-10 w-10 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 disabled:bg-white/10 disabled:text-white/30 transition-all shadow-md"
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
