"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

interface HistoryEntry {
  id: string;
  model: Model;
  originalPrompt: string;
  optimizedPrompt: string;
  summary: string | null;
  warning: string | null;
  timestamp: number;
  aspect?: AspectRatio;
  duration?: number;
}


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
  warning: string | null;
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
    warning: row.warning || null,
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
  const [promptIssueWarning, setPromptIssueWarning] = useState<string | null>(null);
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
  const [imageSuggestions, setImageSuggestions] = useState<{ category: string; prompt: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const lastSuggestInputRef = useRef<{ image: string; prompt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [promptCheck, setPromptCheck] = useState<{ status: "good" | "warning"; message: string; suggestion?: string | null } | null>(null);
  const [checkingPrompt, setCheckingPrompt] = useState(false);
  const [originalUserPrompt, setOriginalUserPrompt] = useState("");
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
      setImageSuggestions([]);
      setShowTemplates(false);
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
    setImageSuggestions([]);
    setShowTemplates(false);
    lastSuggestInputRef.current = null;
    setPromptCheck(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function fetchImageSuggestions() {
    if (!imageDataUrl || loadingSuggestions) return;
    const currentInput = { image: imageDataUrl, prompt: prompt.trim() };
    // If inputs haven't changed since last fetch, just show cached suggestions
    if (
      lastSuggestInputRef.current &&
      lastSuggestInputRef.current.image === currentInput.image &&
      lastSuggestInputRef.current.prompt === currentInput.prompt &&
      imageSuggestions.length > 0
    ) {
      setShowTemplates(true);
      return;
    }
    setLoadingSuggestions(true);
    setShowTemplates(true);
    setImageSuggestions([]);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          action: "suggest",
          prompt: currentInput.prompt,
          image: imageDataUrl,
          duration: model === "wan" ? wanDuration : 8,
          aspect: model === "grok" ? grokAspect : wanAspect,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setImageSuggestions(data.suggestions || []);
        lastSuggestInputRef.current = currentInput;
      }
    } catch {
      // Silently fail — suggestions are a nice-to-have
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function checkPromptFeasibility() {
    if (!prompt.trim() || !imageDataUrl || checkingPrompt) return;
    setOriginalUserPrompt(prompt.trim());
    setCheckingPrompt(true);
    setPromptCheck(null);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          action: "check",
          prompt: prompt.trim(),
          image: imageDataUrl,
          duration: model === "wan" ? wanDuration : 8,
          aspect: model === "grok" ? grokAspect : wanAspect,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPromptCheck(data);
      }
    } catch {
      // Silently fail
    } finally {
      setCheckingPrompt(false);
    }
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
    setPromptIssueWarning(null);
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

  async function addToHistory(optimizedPrompt: string, sum: string | null, warn: string | null) {
    if (!user) return;
    const { data } = await supabase
      .from("prompt_history")
      .insert({
        user_id: user.id,
        model,
        original_prompt: originalUserPrompt || prompt,
        optimized_prompt: optimizedPrompt,
        summary: sum,
        warning: warn,
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
      setPromptIssueWarning(data.warning || null);
      setAnsweredQuestions(allQuestions);
      setStep("result");
      addToHistory(data.rewritten, data.summary || null, data.warning || null);
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
    setPromptIssueWarning(null);
    setError("");
    setReadyToGenerate(false);
    setStep("input");
    autoFetchTriggered.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleUseSuggestion(suggestionPrompt: string) {
    setRewritten(suggestionPrompt);
    setPrompt(suggestionPrompt);
    setShowTemplates(false);
    setSummary(null);
    setPromptIssueWarning(null);
    setStep("result");
    addToHistory(suggestionPrompt, "Used AI suggestion", null);
  }

  const expandPromptRef = useRef<string | null>(null);

  // When prompt updates after "Expand on this", trigger analyze
  useEffect(() => {
    if (expandPromptRef.current && prompt === expandPromptRef.current) {
      expandPromptRef.current = null;
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  function handleExpandSuggestion(suggestionPrompt: string) {
    expandPromptRef.current = suggestionPrompt;
    setPrompt(suggestionPrompt);
    setShowTemplates(false);
  }

  const promptWarning = useMemo(() => {
    const text = prompt.toLowerCase().trim();
    if (!text) return null;

    const warnings: { pattern: RegExp; message: string }[] = [
      { pattern: /\b(text|words?|letters?|caption|subtitle)\s+(appear|fade|animate|move|fly|scroll|type)\b/, message: "These AI models can't reliably generate or animate new readable text on screen. Any new text will come out distorted." },
      { pattern: /\b(multiple\s+scenes?|scene\s+change|cut\s+to|transition\s+to|next\s+scene)\b/, message: "These models create a single continuous clip — they can't do scene changes or transitions between different shots." },
      { pattern: /\b(teleport|transform\s+into|morph\s+into|shape\s*shift|turn\s+into\s+a)\b/, message: "Major transformations and morphing effects are beyond what these models handle well. Stick to natural, realistic motion." },
      { pattern: /\b(close\s*-?\s*up\s+(of\s+)?(hand|finger)|detailed\s+(hand|finger)|finger\s+(movement|position|gesture)s?)\b/, message: "These models struggle with detailed hand and finger movements. Close-ups of hands often render with extra or distorted fingers." },
      { pattern: /\b(crowd|dozens|hundreds|many\s+people|large\s+group)\b/, message: "Dense crowds and large groups of people tend to lose coherence — individual faces and bodies may blur or distort." },
      { pattern: /\b(write|writing|draws?|drawing|typing|types?)\s+(a\s+)?(text|words?|letters?|sentence|message|note)\b/, message: "These models can't generate legible handwriting or typed text. Any written text in the video will likely be unreadable." },
    ];

    for (const w of warnings) {
      if (w.pattern.test(text)) return w.message;
    }
    return null;
  }, [prompt]);

  function handleLoadFromHistory(entry: HistoryEntry) {
    setModel(entry.model);
    setRewritten(entry.optimizedPrompt);
    setSummary(entry.summary);
    setPromptIssueWarning(entry.warning);
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
      setPromptIssueWarning(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  // Score bar component
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

        {/* How it works guide */}
        {step === "input" && (
          <div className="mb-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <p className="text-sm font-semibold text-slate-200 mb-3 text-center">How to use this tool</p>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">1</span>
                <p className="text-slate-400"><span className="text-slate-200 font-medium">Choose your model &amp; format</span> — select Grok (8s clips) or Wan (5s/10s clips), then pick 16:9 wide or 9:16 vertical.</p>
              </div>
              <div className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">2</span>
                <p className="text-slate-400"><span className="text-slate-200 font-medium">Upload your image</span> — this is the image that will be animated into a video. The AI analyzes it to make sure your prompt matches what&apos;s in the image.</p>
              </div>
              <div className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">3</span>
                <p className="text-slate-400"><span className="text-slate-200 font-medium">Describe how it should move</span> (optional) — tell us what motion or action you want. Not sure? Leave it blank and we&apos;ll ask you questions, or click <span className="text-slate-300">Get AI suggestions</span> for ideas tailored to your image.</p>
              </div>
              <div className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">4</span>
                <p className="text-slate-400"><span className="text-slate-200 font-medium">Get your prompt</span> — we&apos;ll generate an optimized prompt you can copy and paste directly into {model === "grok" ? "Grok" : "Wan"} to create your video.</p>
              </div>
            </div>
          </div>
        )}

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
                Upload Your Image
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
                  <p className="text-slate-600 text-xs mt-2">
                    JPG, PNG, or WebP — max 20MB
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

            {/* Prompt input — hidden when viewing suggestions */}
            {!showTemplates && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Describe what you want to create
                    <span className="text-slate-500 font-normal"> — or leave blank and we&apos;ll help you figure it out</span>
                  </label>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setPromptCheck(null); }}
                  placeholder="Describe how you want this image to come alive as a video... or leave empty and we'll ask you questions!"
                  rows={4}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                />
                {prompt.trim() && imageDataUrl && !promptCheck && (
                  <button
                    onClick={checkPromptFeasibility}
                    disabled={checkingPrompt}
                    className="mt-3 w-full py-3 px-4 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {checkingPrompt ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Checking your prompt...
                      </>
                    ) : (
                      <>
                        <span className="text-lg">&#128269;</span>
                        Check if this will work with {model === "grok" ? "Grok" : "Wan"}
                      </>
                    )}
                  </button>
                )}
                {promptCheck && (
                  <div className={`mt-2 p-3 rounded-lg text-sm ${
                    promptCheck.status === "good"
                      ? "bg-emerald-900/40 border border-emerald-700/60 text-emerald-200"
                      : "bg-amber-900/40 border border-amber-700/60 text-amber-200"
                  }`}>
                    <div className="flex gap-2">
                      <span className={`mt-0.5 shrink-0 ${promptCheck.status === "good" ? "text-emerald-400" : "text-amber-400"}`}>
                        {promptCheck.status === "good" ? "\u2705" : "\u26A0\uFE0F"}
                      </span>
                      <span>{promptCheck.message}</span>
                    </div>
                    {promptCheck.suggestion && (
                      <div className="mt-3 pt-3 border-t border-amber-700/40">
                        <span className="text-xs text-amber-400 uppercase tracking-wide font-semibold block mb-2">Suggested rewrite</span>
                        <p className="text-amber-100 text-sm mb-3">{promptCheck.suggestion}</p>
                        <button
                          onClick={() => {
                            setPrompt(promptCheck.suggestion!);
                            setPromptCheck({ status: "good", message: "Using the suggested rewrite — you're good to go!" });
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-500 transition-colors cursor-pointer"
                        >
                          Use this instead
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {promptWarning && !promptCheck && (
                  <div className="mt-2 p-3 rounded-lg bg-amber-900/40 border border-amber-700/60 text-amber-200 text-sm flex gap-2">
                    <span className="text-amber-400 mt-0.5 shrink-0">&#9888;</span>
                    <span>{promptWarning}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons — two paths */}
            {!showTemplates ? (
              <>
                <div className="space-y-3">
                  {imageDataUrl && (
                    <p className="text-center text-sm text-slate-400">
                      {prompt.trim() && !promptCheck
                        ? "Check your prompt first, then choose how to proceed"
                        : prompt.trim()
                        ? "Ready? Choose how to proceed"
                        : "Choose how you\u2019d like to create your prompt"}
                    </p>
                  )}
                  {prompt.trim() && !promptCheck && imageDataUrl && (
                    <p className="text-center text-xs text-amber-400/70">
                      Please check your prompt above before continuing
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        if (!imageDataUrl) return;
                        if (imageSuggestions.length > 0) {
                          setShowTemplates(true);
                        } else {
                          fetchImageSuggestions();
                        }
                      }}
                      disabled={loading || loadingSuggestions || !imageDataUrl || (!!prompt.trim() && !promptCheck)}
                      className="py-4 px-4 rounded-lg font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {loadingSuggestions ? "Analyzing your image..." : "Give Me Prompt Ideas"}
                      <span className="block text-xs font-normal text-indigo-200/70 mt-1">AI suggests ready-to-use prompts</span>
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={loading || !imageDataUrl || (!!prompt.trim() && !promptCheck)}
                      className="py-4 px-4 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-700 to-slate-600 text-white hover:from-slate-600 hover:to-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border border-slate-600/50"
                    >
                      {loading ? loadingMessage : "Guide Me With Questions"}
                      <span className="block text-xs font-normal text-slate-300/70 mt-1">Answer a few quick questions</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* AI-generated suggestions grid */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Prompt ideas for your image</p>
                    <button
                      onClick={() => setShowTemplates(false)}
                      className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                    >
                      Back
                    </button>
                  </div>
                  {imageSuggestions.length > 0 ? (
                    <div className="space-y-4">
                      {imageSuggestions.map((t, i) => (
                        <div
                          key={`sug-${i}`}
                          className="p-4 rounded-lg bg-slate-800 border border-slate-700/50"
                        >
                          <span className="text-sm text-indigo-400 font-semibold">{t.category}</span>
                          <p className="text-slate-300 text-sm mt-2 leading-relaxed">{t.prompt}</p>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleUseSuggestion(t.prompt)}
                              className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 transition-colors cursor-pointer"
                            >
                              Use This
                            </button>
                            <button
                              onClick={() => handleExpandSuggestion(t.prompt)}
                              className="px-4 py-2 rounded-md text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              Refine This
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      {loadingSuggestions ? "Analyzing your image..." : "No suggestions available"}
                    </div>
                  )}
                  {imageSuggestions.length > 0 && (
                    <button
                      onClick={() => {
                        setShowTemplates(false);
                        handleAnalyze();
                      }}
                      className="w-full mt-3 py-2.5 rounded-lg font-medium text-sm text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-all cursor-pointer"
                    >
                      None of these — guide me with questions instead
                    </button>
                  )}
                </div>
              </>
            )}

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
            {(originalUserPrompt || prompt.trim()) && (
              <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Your original idea</span>
                <p className="text-slate-400 mt-1 text-sm">{originalUserPrompt || prompt}</p>
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

            {/* Warning about original prompt issues */}
            {promptIssueWarning && (
              <div className="mt-3 p-3 rounded-lg bg-amber-900/40 border border-amber-700/60 flex gap-2">
                <span className="text-amber-400 mt-0.5 shrink-0 text-lg">&#9888;</span>
                <div>
                  <span className="text-xs text-amber-400 uppercase tracking-wide font-semibold block mb-1">Heads up about your original prompt</span>
                  <p className="text-amber-200 text-sm">{promptIssueWarning}</p>
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
                  setPromptIssueWarning(null);
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
