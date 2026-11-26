import { Sparkles } from "lucide-react";

export function PromptTemplates({ onSelect }: { onSelect: (prompt: string) => void }) {
  const templates = [
    "Summarize the key points in 3 bullets.",
    "What are the main action items?",
    "Extract any financial figures mentioned.",
    "What are the risks outlined in this document?"
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
      {templates.map((template, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(template)}
          className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors glass-panel"
        >
          <Sparkles className="h-3 w-3 text-indigo-400" />
          {template}
        </button>
      ))}
    </div>
  );
}
