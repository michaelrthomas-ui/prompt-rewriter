"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Model = "grok" | "wan";
type AspectRatio = "16:9" | "9:16";

interface AnsweredQuestion {
  question: string;
  answer: string;
}

interface PendingQuestion {
  question: string;
  answer: string | null;
  customText: string;
  useCustom: boolean;
}

interface PromptScores {
  specificity: number;
  camera: number;
  motion: number;
  lighting: number;
  audio: number;
}

interface HistoryEntry {
  id: string;
  model: Model;
  originalPrompt: string;
  optimizedPrompt: string;
  summary: string | null;
  scores: PromptScores | null;
  timestamp: number;
  aspect?: AspectRatio;
  duration?: number;
}

const TEMPLATES = [
  { category: "Cinematic Nature", prompt: "A lone wolf standing on a snow-covered cliff at golden hour, wind blowing through its fur" },
  { category: "Dramatic Action", prompt: "A vintage muscle car drifting around a rain-soaked city corner at night, headlights cutting through steam" },
  { category: "Ethereal Portrait", prompt: "A woman with flowing silver hair standing in a field of lavender, petals swirling around her" },
  { category: "Surreal Fantasy", prompt: "A giant whale swimming through clouds above a small mountain village at sunset" },
  { category: "Product Shot", prompt: "A luxury watch sitting on a dark marble surface with water droplets slowly rolling off the crystal" },
  { category: "Underwater", prompt: "A sea turtle gliding through a sunlit coral reef, schools of tropical fish scattering in its wake" },
  { category: "Space / Sci-Fi", prompt: "An astronaut floating in front of a massive nebula, helmet visor reflecting swirling purple and gold gases" },
  { category: "Abstract Art", prompt: "Liquid mercury and molten gold colliding in slow motion, forming intricate organic patterns" },
];

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getWordCountColor(count: number): string {
  if (count <= 30) return "text-red-400";
  if (count <= 49) return "text-amber-400";
  if (count <= 150) return "text-emerald-400";
  if (count <= 200) return "text-amber-400";
  return "text-red-400";
}

function getWordCountLabel(count: number): string {
  if (count <= 30) return "Too short";
  if (count <= 49) return "A bit short";
  if (count <= 150) return "Sweet spot";
  if (count <= 200) return "Getting long";
  return "Too long";
}

// Database row shape from Supabase
interface HistoryRow {
  id: string;
  model: string;
  original_prompt: string;
  optimized_prompt: string;
  summary: string | null;
  scores: PromptScores | null;
  aspect: string | null;
  duration: number | null;
  created_at: string;
}

function rowToEntry(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    model: row.model as Model,
    originalPrompt: row.original_prompt,
    optimizedPrompt: row.optimized_prompt,
    summary: row.summary,
    scores: row.scores,
    timestamp: new Date(row.created_at).getTime(),
    aspect: row.aspect as AspectRatio | undefined,
    duration: row.duration ?? undefined,
  };
}

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [model, setModel] = useState<Model>("grok");
  const [prompt, setPrompt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [rewritten, setRewritten] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [scores, setScores] = useState<PromptScores | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"input" | "questions" | "result">("input");
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [wanDuration, setWanDuration] = useState<5 | 10>(5);
  const [grokAspect, setGrokAspect] = useState<AspectRatio>("16:9");
  const [wanAspect, setWanAspect] = useState<AspectRatio>("16:9");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load user and history on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser({ id: user.id, email: user.email ?? undefined });
    });
  }, [supabase.auth]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("prompt_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setHistory((data as HistoryRow[]).map(rowToEntry));
        }
      });
  }, [user, supabase]);

  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1024;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  function processImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP, etc.)");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Image must be under 20MB");
      return;
    }
    setImageName(file.name);
    resizeImage(file).then((dataUrl) => {
      setImageDataUrl(dataUrl);
      setError("");
    });
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  }

  function handleRemoveImage() {
    setImageDataUrl(null);
    setImageName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processImage(file);
  }

  function getResolvedAnswer(q: PendingQuestion): string {
    if (q.useCustom && q.customText.trim()) return q.customText.trim();
    if (q.answer === "yes" || q.answer === "no") return q.answer === "yes" ? "Yes" : "No";
    return "";
  }

  const currentAspect = model === "grok" ? grokAspect : wanAspect;

  // Scroll to bottom when new content appears
  useEffect(() => {
    if (step === "questions") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [pendingQuestions, loading, step]);

  async function handleAnalyze() {
    if (!prompt.trim() && !imageDataUrl) return;
    setLoading(true);
    setLoadingMessage(
      !prompt.trim() && imageDataUrl
        ? "Analyzing your image..."
        : imageDataUrl
        ? "Analyzing your prompt and image..."
        : "Analyzing your prompt..."
    );
    setError("");
    setPendingQuestions([]);
    setAnsweredQuestions([]);
    setRewritten("");
    setSummary(null);
    setScores(null);
    setReadyToGenerate(false);

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          action: "analyze",
          prompt,
          image: imageDataUrl || undefined,
          duration: model === "wan" ? wanDuration : 8,
          aspect: currentAspect,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to analyze prompt");
      }

      const data = await res.json();
      setPendingQuestions(
        data.questions.map((q: string) => ({ question: q, answer: null, customText: "", useCustom: false }))
      );
      setReadyToGenerate(!!data.readyToGenerate);
      setStep("questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  function handleAnswer(index: number, answer: "yes" | "no") {
    setPendingQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, answer, useCustom: false } : q))
    );
  }

  function handleCustomToggle(index: number) {
    setPendingQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, useCustom: !q.useCustom, answer: q.useCustom ? q.answer : null } : q))
    );
  }

  function handleCustomText(index: number, text: string) {
    setPendingQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, customText: text } : q))
    );
  }

  const allAnswered = pendingQuestions.length > 0 && pendingQuestions.every((q) => {
    if (q.useCustom) return q.customText.trim().length > 0;
    return q.answer !== null;
  });

  function collectAllQuestions(): AnsweredQuestion[] {
    return [
      ...answeredQuestions,
      ...pendingQuestions.map((q) => ({
        question: q.question,
        answer: getResolvedAnswer(q),
      })),
    ];
  }

  const fetchMoreQuestions = useCallback(async (allQuestions: AnsweredQuestion[]) => {
    setLoading(true);
    setLoadingMessage("Thinking of more questions...");
    setError("");

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          action: "analyze",
          prompt,
          questions: allQuestions,
          image: imageDataUrl || undefined,
          duration: model === "wan" ? wanDuration : 8,
          aspect: currentAspect,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get more questions");
      }

      const data = await res.json();
      setAnsweredQuestions(allQuestions);
      setPendingQuestions(
        data.questions.map((q: string) => ({ question: q, answer: null, customText: "", useCustom: false }))
      );
      setReadyToGenerate(!!data.readyToGenerate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }, [model, prompt, imageDataUrl, wanDuration, currentAspect]);

  // Auto-continue: when all questions are answered and AI isn't ready yet, auto-fetch more
  const autoFetchTriggered = useRef(false);
  useEffect(() => {
    if (allAnswered && !loading && step === "questions" && !readyToGenerate && !autoFetchTriggered.current) {
      autoFetchTriggered.current = true;
      const allQ = collectAllQuestions();
      fetchMoreQuestions(allQ);
    }
    // Reset trigger when new questions arrive
    if (!allAnswered) {
      autoFetchTriggered.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, loading, step, readyToGenerate]);

  async function addToHistory(optimizedPrompt: string, sum: string | null, sc: PromptScores | null) {
    if (!user) return;
    const { data } = await supabase
      .from("prompt_history")
      .insert({
        user_id: user.id,
        model,
        original_prompt: prompt,
        optimized_prompt: optimizedPrompt,
        summary: sum,
        scores: sc,
        aspect: currentAspect,
        duration: model === "wan" ? wanDuration : 8,
      })
      .select()
      .single();

    if (data) {
      setHistory((prev) => [rowToEntry(data as HistoryRow), ...prev].slice(0, 50));
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setLoadingMessage("Crafting your optimized prompt...");
    setError("");

    const allQuestions = collectAllQuestions();

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          action: "generate",
          prompt,
          questions: allQuestions,
          image: imageDataUrl || undefined,
          duration: model === "wan" ? wanDuration : 8,
          aspect: currentAspect,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate prompt");
      }

      const data = await res.json();
      setRewritten(data.rewritten);
      setSummary(data.summary || null);
      setScores(data.scores || null);
      setAnsweredQuestions(allQuestions);
      setStep("result");
      addToHistory(data.rewritten, data.summary || null, data.scores || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function handleSurpriseMe() {
    setLoading(true);
    setLoadingMessage("Cooking up something creative...");
    setError("");
    setPendingQuestions([]);
    setAnsweredQuestions([]);
    setSummary(null);
    setScores(null);

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          action: "surprise",
          prompt: "surprise",
          duration: model === "wan" ? wanDuration : 8,
          aspect: currentAspect,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate surprise prompt");
      }

      const data = await res.json();
      setRewritten(data.rewritten);
      setPrompt("");
      setStep("result");
      addToHistory(data.rewritten, `Random ${data.category || "creative"} prompt generated`, null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function handleKeepRefining() {
    const allQuestions = collectAllQuestions();
    autoFetchTriggered.current = true;
    await fetchMoreQuestions(allQuestions);
  }

  function handleStartOver() {
    setPrompt("");
    setImageDataUrl(null);
    setImageName("");
    setAnsweredQuestions([]);
    setPendingQuestions([]);
    setRewritten("");
    setSummary(null);
    setScores(null);
    setError("");
    setReadyToGenerate(false);
    setStep("input");
    autoFetchTriggered.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleUseTemplate(templatePrompt: string) {
    setPrompt(templatePrompt);
    setShowTemplates(false);
  }

  function handleLoadFromHistory(entry: HistoryEntry) {
    setModel(entry.model);
    setRewritten(entry.optimizedPrompt);
    setSummary(entry.summary);
    setScores(entry.scores);
    setPrompt(entry.originalPrompt);
    if (entry.aspect) {
      if (entry.model === "grok") setGrokAspect(entry.aspect);
      else setWanAspect(entry.aspect);
    }
    setStep("result");
    setShowHistory(false);
  }

  async function handleDeleteHistory(id: string) {
    await supabase.from("prompt_history").delete().eq("id", id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }

  async function handleClearHistory() {
    if (!user) return;
    await supabase.from("prompt_history").delete().eq("user_id", user.id);
    setHistory([]);
    setShowHistory(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Separate the prompt from any TIP line
  function getPromptAndTip(text: string): { prompt: string; tip: string | null } {
    const tipMatch = text.match(/\n\n?(⚠️ TIP:[\s\S]+)$/);
    if (tipMatch) {
      return {
        prompt: text.slice(0, tipMatch.index).trim(),
        tip: tipMatch[1].trim(),
      };
    }
    return { prompt: text, tip: null };
  }

  const { prompt: cleanPrompt, tip: promptTip } = getPromptAndTip(rewritten);
  const wordCount = getWordCount(cleanPrompt);

  function handleCopy() {
    navigator.clipboard.writeText(cleanPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSplitIntoClips() {
    setLoading(true);
    setLoadingMessage("Splitting into separate clips...");
    setError("");

    const allQuestions = collectAllQuestions();

    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          action: "split",
          prompt: cleanPrompt,
          questions: allQuestions,
          image: imageDataUrl || undefined,
          duration: model === "wan" ? wanDuration : 8,
          aspect: currentAspect,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to split prompt");
      }

      const data = await res.json();
      setRewritten(data.rewritten);
      setSummary(null);
      setScores(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  // Score bar component
  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            value >= 8 ? "bg-emerald-500" : value >= 5 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-6 text-right ${
        value >= 8 ? "text-emerald-400" : value >= 5 ? "text-amber-400" : "text-red-400"
      }`}>{value}</span>
    </div>
  );

  // Shared image thumbnail component
  const ImageThumbnail = () =>
    imageDataUrl ? (
      <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <span className="text-xs text-slate-500 uppercase tracking-wide">Reference image</span>
        <div className="mt-2 relative w-full max-w-[200px]">
          <Image
            src={imageDataUrl}
            alt="Reference"
            width={200}
            height={200}
            className="rounded-lg object-cover"
            unoptimized
          />
        </div>
      </div>
    ) : null;

  // Aspect ratio selector component (shared between Grok and Wan)
  const AspectSelector = ({ value, onChange, variant }: { value: AspectRatio; onChange: (v: AspectRatio) => void; variant: "indigo" | "purple" }) => {
    const activeClass = variant === "indigo"
      ? "bg-indigo-600/80 text-white shadow-lg shadow-indigo-500/20"
      : "bg-purple-600/80 text-white shadow-lg shadow-purple-500/20";
    return (
      <div className="flex gap-2 items-center">
        <span className="text-slate-400 text-sm mr-2">Format:</span>
        <button
          onClick={() => onChange("16:9")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
            value === "16:9" ? activeClass : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          16:9 Wide
        </button>
        <button
          onClick={() => onChange("9:16")}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
            value === "9:16" ? activeClass : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          9:16 Vertical
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* User bar */}
        {user && (
          <div className="flex items-center justify-end gap-3 mb-4">
            <span className="text-xs text-slate-500">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}

        <h1 className="text-3xl font-bold text-center mb-2">
          AI Video Prompt Rewriter
        </h1>
        <p className="text-center text-slate-400 mb-4">
          We&apos;ll figure out exactly what you want, then craft the perfect prompt
        </p>

        {/* History button */}
        {history.length > 0 && step === "input" && (
          <div className="flex justify-center mb-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            >
              {showHistory ? "Hide History" : `View History (${history.length})`}
            </button>
          </div>
        )}

        {/* History panel */}
        {showHistory && step === "input" && (
          <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Recent Prompts</span>
              <button
                onClick={handleClearHistory}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2">
              {history.map((entry) => (
                <div key={entry.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadFromHistory(entry)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          entry.model === "grok" ? "bg-indigo-600/30 text-indigo-400" : "bg-purple-600/30 text-purple-400"
                        }`}>
                          {entry.model.toUpperCase()}
                        </span>
                        {entry.aspect && (
                          <span className="text-xs text-slate-500">{entry.aspect}</span>
                        )}
                        <span className="text-xs text-slate-600">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm line-clamp-2">{entry.optimizedPrompt}</p>
                      {entry.originalPrompt && (
                        <p className="text-slate-500 text-xs mt-1 truncate">From: &ldquo;{entry.originalPrompt}&rdquo;</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteHistory(entry.id); }}
                      className="text-slate-600 hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model selector */}
        <div className="flex gap-3 mb-6 justify-center">
          <button
            onClick={() => { if (step === "input") setModel("grok"); }}
            className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all cursor-pointer ${
              model === "grok"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            } ${step !== "input" ? "opacity-60 cursor-default" : ""}`}
          >
            Grok
          </button>
          <button
            onClick={() => { if (step === "input") setModel("wan"); }}
            className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all cursor-pointer ${
              model === "wan"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            } ${step !== "input" ? "opacity-60 cursor-default" : ""}`}
          >
            Wan
          </button>
        </div>

        {/* Wan duration + aspect ratio selector */}
        {model === "wan" && step === "input" && (
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="flex gap-2 items-center">
              <span className="text-slate-400 text-sm mr-2">Duration:</span>
              <button
                onClick={() => setWanDuration(5)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                  wanDuration === 5
                    ? "bg-purple-600/80 text-white shadow-lg shadow-purple-500/20"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                5 seconds
              </button>
              <button
                onClick={() => setWanDuration(10)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                  wanDuration === 10
                    ? "bg-purple-600/80 text-white shadow-lg shadow-purple-500/20"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                10 seconds
              </button>
            </div>
            <AspectSelector value={wanAspect} onChange={setWanAspect} variant="purple" />
          </div>
        )}

        {/* Grok aspect ratio selector */}
        {model === "grok" && step === "input" && (
          <div className="flex flex-col items-center gap-2 mb-6">
            <AspectSelector value={grokAspect} onChange={setGrokAspect} variant="indigo" />
            <p className="text-slate-500 text-xs">Grok generates ~8 second clips</p>
          </div>
        )}

        {/* Step 1: Prompt input */}
        {step === "input" && (
          <>
            {/* Image upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reference Image <span className="text-slate-500">(optional)</span>
              </label>
              {!imageDataUrl ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg bg-slate-800 border-2 border-dashed border-slate-600 px-4 py-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-slate-800/80 transition-all"
                >
                  <p className="text-slate-400">
                    Drop an image here or click to upload
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    Upload the image you want to animate into a video
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex items-start gap-4 p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <Image
                    src={imageDataUrl}
                    alt="Uploaded"
                    width={120}
                    height={120}
                    className="rounded-lg object-cover shrink-0"
                    unoptimized
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{imageName}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      The AI will analyze this image alongside your prompt
                    </p>
                    <button
                      onClick={handleRemoveImage}
                      className="mt-2 text-sm text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt input */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">
                  Describe what you want to create
                  {imageDataUrl && (
                    <span className="text-slate-500 font-normal"> — or leave blank and we&apos;ll help you figure it out</span>
                  )}
                </label>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  imageDataUrl
                    ? "Describe how you want this image to come alive as a video... or leave empty and let us ask you questions!"
                    : model === "grok"
                    ? "e.g. A dog running through a field of flowers..."
                    : "e.g. A woman walking down a city street at night..."
                }
                rows={4}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
              />
            </div>

            {/* Templates toggle */}
            <div className="flex justify-center mb-4">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-sm text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
              >
                {showTemplates ? "Hide Templates" : "Need inspiration? Try a template"}
              </button>
            </div>

            {/* Templates grid */}
            {showTemplates && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => handleUseTemplate(t.prompt)}
                    className="p-3 rounded-lg bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/80 text-left transition-all cursor-pointer group"
                  >
                    <span className="text-xs text-indigo-400 font-medium">{t.category}</span>
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2 group-hover:text-slate-300">{t.prompt}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {imageDataUrl && !prompt.trim() ? (
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="flex-1 py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {loading ? loadingMessage : "Help Me Create a Prompt"}
                </button>
              ) : (
                <button
                  onClick={handleAnalyze}
                  disabled={loading || (!prompt.trim() && !imageDataUrl)}
                  className="flex-1 py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {loading ? loadingMessage : "Let\u2019s Figure Out What You Want"}
                </button>
              )}
            </div>

            {/* Surprise me button */}
            <button
              onClick={handleSurpriseMe}
              disabled={loading}
              className="w-full mt-3 py-2 rounded-lg font-semibold text-sm bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50 transition-all cursor-pointer border border-slate-700/50"
            >
              {loading ? loadingMessage : "Surprise Me — Random Creative Prompt"}
            </button>
          </>
        )}

        {/* Step 2: Questions */}
        {step === "questions" && (
          <>
            {/* Show image if uploaded */}
            <ImageThumbnail />

            {/* Show original prompt or image-only notice */}
            {prompt.trim() ? (
              <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Your idea</span>
                <p className="text-slate-300 mt-1">{prompt}</p>
              </div>
            ) : imageDataUrl ? (
              <div className="mb-4 p-3 rounded-lg bg-indigo-900/30 border border-indigo-700/50">
                <span className="text-xs text-indigo-400 uppercase tracking-wide">Image-only mode</span>
                <p className="text-slate-300 mt-1">We&apos;re building a prompt from scratch based on your image and answers</p>
              </div>
            ) : null}

            {/* Ready to generate notification - sticky at top */}
            {readyToGenerate && (
              <div className="mb-4 p-4 rounded-lg bg-emerald-900/40 border-2 border-emerald-500/60 shadow-lg shadow-emerald-500/10">
                <p className="text-emerald-300 font-medium mb-3">
                  The AI has enough info to write a great prompt!
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex-1 py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Generate Prompt Now
                  </button>
                  <button
                    onClick={() => {/* user just keeps answering below */}}
                    className="px-4 py-3 rounded-lg font-semibold text-sm bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all cursor-pointer"
                  >
                    Keep Refining
                  </button>
                </div>
              </div>
            )}

            {/* Show previously answered questions */}
            {answeredQuestions.length > 0 && (
              <div className="mb-4 space-y-2">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Previous answers ({answeredQuestions.length})</span>
                {answeredQuestions.map((q, i) => (
                  <div key={`answered-${i}`} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5 ${
                      q.answer === "Yes" ? "bg-emerald-600/30 text-emerald-400"
                        : q.answer === "No" ? "bg-red-600/30 text-red-400"
                        : "bg-blue-600/30 text-blue-400"
                    }`}>
                      {q.answer.length <= 3 ? q.answer.toUpperCase() : "CUSTOM"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-400 text-sm">{q.question}</span>
                      {q.answer.length > 3 && (
                        <p className="text-slate-300 text-sm mt-1 italic">&ldquo;{q.answer}&rdquo;</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Current questions */}
            {pendingQuestions.length > 0 && (
              <div className="space-y-3 mb-6">
                <span className="text-xs text-slate-500 uppercase tracking-wide">
                  {readyToGenerate ? "Optional: fine-tune further" : "Help us understand what you want"}
                </span>
                {pendingQuestions.map((q, i) => (
                  <div
                    key={`pending-${i}`}
                    className="p-4 rounded-lg bg-slate-800 border border-slate-700"
                  >
                    <p className="text-white mb-3">{q.question}</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleAnswer(i, "yes")}
                        className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                          q.answer === "yes" && !q.useCustom
                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleAnswer(i, "no")}
                        className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                          q.answer === "no" && !q.useCustom
                            ? "bg-red-600 text-white shadow-lg shadow-red-500/30"
                            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                        }`}
                      >
                        No
                      </button>
                      <button
                        onClick={() => handleCustomToggle(i)}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                          q.useCustom
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                        }`}
                      >
                        Other...
                      </button>
                    </div>
                    {q.useCustom && (
                      <input
                        type="text"
                        value={q.customText}
                        onChange={(e) => handleCustomText(i, e.target.value)}
                        placeholder="Type your answer..."
                        autoFocus
                        className="mt-3 w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* When ready and all answered, show generate button again at bottom */}
            {readyToGenerate && allAnswered && !loading && (
              <div className="flex gap-3 mb-4">
                <button
                  onClick={handleGenerate}
                  className="flex-1 py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Generate Prompt
                </button>
                <button
                  onClick={handleKeepRefining}
                  className="flex-1 py-3 rounded-lg font-semibold text-lg bg-slate-700 text-white hover:bg-slate-600 transition-all cursor-pointer"
                >
                  Keep Refining
                </button>
              </div>
            )}

            {/* Before ready, show generate option after answering */}
            {!readyToGenerate && allAnswered && !loading && (
              <div className="mb-4">
                <button
                  onClick={handleGenerate}
                  className="w-full py-3 rounded-lg font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all cursor-pointer text-sm"
                >
                  Generate prompt with what we have so far
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center py-4 text-slate-400 animate-pulse">
                {loadingMessage}
              </div>
            )}

            <button
              onClick={handleStartOver}
              className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
            >
              Start Over
            </button>

            <div ref={bottomRef} />
          </>
        )}

        {/* Step 3: Result */}
        {step === "result" && (
          <>
            {/* Show image if uploaded */}
            <ImageThumbnail />

            {/* Before / After comparison */}
            {prompt.trim() && (
              <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Your original idea</span>
                <p className="text-slate-400 mt-1 text-sm">{prompt}</p>
              </div>
            )}
            {!prompt.trim() && imageDataUrl && (
              <div className="mb-4 p-3 rounded-lg bg-indigo-900/30 border border-indigo-700/50">
                <span className="text-xs text-indigo-400 uppercase tracking-wide">Built from your image</span>
                <p className="text-slate-300 mt-1">Prompt created based on your image and answers</p>
              </div>
            )}

            {/* What Changed summary */}
            {summary && (
              <div className="mb-4 p-3 rounded-lg bg-blue-900/20 border border-blue-700/40">
                <span className="text-xs text-blue-400 uppercase tracking-wide">What we improved</span>
                <p className="text-slate-300 mt-1 text-sm">{summary}</p>
              </div>
            )}

            {/* Show Q&A summary (collapsed) */}
            {answeredQuestions.length > 0 && (
              <details className="mb-4">
                <summary className="text-xs text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-400">
                  Show Q&A ({answeredQuestions.length} questions answered)
                </summary>
                <div className="mt-2 space-y-2">
                  {answeredQuestions.map((q, i) => (
                    <div key={`result-q-${i}`} className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 mt-0.5 ${
                        q.answer === "Yes" ? "bg-emerald-600/30 text-emerald-400"
                          : q.answer === "No" ? "bg-red-600/30 text-red-400"
                          : "bg-blue-600/30 text-blue-400"
                      }`}>
                        {q.answer.length <= 3 ? q.answer.toUpperCase() : "CUSTOM"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-400 text-sm">{q.question}</span>
                        {q.answer.length > 3 && (
                          <p className="text-slate-300 text-sm mt-1 italic">&ldquo;{q.answer}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Optimized prompt */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-emerald-400">
                  Your Optimized Prompt
                </label>
                <div className="flex items-center gap-3">
                  {/* Word count */}
                  <span className={`text-xs font-medium ${getWordCountColor(wordCount)}`}>
                    {wordCount} words &middot; {getWordCountLabel(wordCount)}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-sm text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
                  >
                    {copied ? "Copied!" : "Copy to clipboard"}
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-slate-800 border border-emerald-700/50 px-4 py-3 text-white whitespace-pre-wrap">
                {cleanPrompt}
              </div>
            </div>

            {/* Prompt Scores */}
            {scores && (
              <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <span className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">Prompt Quality Score</span>
                <div className="space-y-1.5">
                  <ScoreBar label="Specificity" value={scores.specificity} />
                  <ScoreBar label="Camera" value={scores.camera} />
                  <ScoreBar label="Motion" value={scores.motion} />
                  <ScoreBar label="Lighting" value={scores.lighting} />
                  <ScoreBar label="Audio" value={scores.audio} />
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Overall</span>
                  <span className={`text-sm font-bold ${
                    (scores.specificity + scores.camera + scores.motion + scores.lighting + scores.audio) / 5 >= 8
                      ? "text-emerald-400"
                      : (scores.specificity + scores.camera + scores.motion + scores.lighting + scores.audio) / 5 >= 5
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}>
                    {((scores.specificity + scores.camera + scores.motion + scores.lighting + scores.audio) / 5).toFixed(1)}/10
                  </span>
                </div>
              </div>
            )}

            {/* TIP shown outside the copy area */}
            {promptTip && (
              <div className="mt-3 p-3 rounded-lg bg-amber-900/30 border border-amber-700/50">
                <p className="text-amber-300 text-sm">{promptTip}</p>
                <button
                  onClick={handleSplitIntoClips}
                  disabled={loading}
                  className="mt-2 px-4 py-2 rounded-lg font-semibold text-sm bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? "Splitting..." : "Split Into Separate Clips"}
                </button>
              </div>
            )}

            {/* Post-result actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setRewritten("");
                  setSummary(null);
                  setScores(null);
                  setPendingQuestions([]);
                  setStep("questions");
                  autoFetchTriggered.current = false;
                  const allQ = collectAllQuestions();
                  fetchMoreQuestions(allQ);
                }}
                disabled={loading}
                className="flex-1 py-3 rounded-lg font-semibold bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? loadingMessage : "Refine Further"}
              </button>
              <button
                onClick={handleStartOver}
                className="flex-1 py-3 rounded-lg font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all cursor-pointer"
              >
                New Prompt
              </button>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-900/50 border border-red-700 text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
