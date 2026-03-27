"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

type Model = "grok" | "wan";

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

export default function Home() {
  const [model, setModel] = useState<Model>("grok");
  const [prompt, setPrompt] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [rewritten, setRewritten] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"input" | "questions" | "result">("input");
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [wanDuration, setWanDuration] = useState<5 | 10>(5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
  }, [model, prompt, imageDataUrl]);

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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate prompt");
      }

      const data = await res.json();
      setRewritten(data.rewritten);
      setAnsweredQuestions(allQuestions);
      setStep("result");
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
    setError("");
    setReadyToGenerate(false);
    setStep("input");
    autoFetchTriggered.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  function handleCopy() {
    navigator.clipboard.writeText(cleanPrompt);
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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to split prompt");
      }

      const data = await res.json();
      setRewritten(data.rewritten);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

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

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-2">
          AI Video Prompt Rewriter
        </h1>
        <p className="text-center text-slate-400 mb-8">
          We&apos;ll figure out exactly what you want, then craft the perfect prompt
        </p>

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

        {/* Wan duration selector */}
        {model === "wan" && step === "input" && (
          <div className="flex gap-2 mb-6 justify-center">
            <span className="text-slate-400 text-sm self-center mr-2">Duration:</span>
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
        )}

        {/* Grok duration info */}
        {model === "grok" && step === "input" && (
          <p className="text-center text-slate-500 text-xs mb-6">Grok generates ~8 second clips</p>
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
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Describe what you want to create
                {imageDataUrl && (
                  <span className="text-slate-500 font-normal"> — or leave blank and we&apos;ll help you figure it out</span>
                )}
              </label>
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

            {imageDataUrl && !prompt.trim() ? (
              <div className="flex gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="flex-1 py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {loading ? loadingMessage : "Help Me Create a Prompt"}
                </button>
              </div>
            ) : (
              <button
                onClick={handleAnalyze}
                disabled={loading || (!prompt.trim() && !imageDataUrl)}
                className="w-full py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {loading ? loadingMessage : "Let\u2019s Figure Out What You Want"}
              </button>
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

            {/* Show original prompt */}
            {prompt.trim() ? (
              <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Your idea</span>
                <p className="text-slate-300 mt-1">{prompt}</p>
              </div>
            ) : imageDataUrl ? (
              <div className="mb-4 p-3 rounded-lg bg-indigo-900/30 border border-indigo-700/50">
                <span className="text-xs text-indigo-400 uppercase tracking-wide">Built from your image</span>
                <p className="text-slate-300 mt-1">Prompt created based on your image and answers</p>
              </div>
            ) : null}

            {/* Show Q&A summary */}
            {answeredQuestions.length > 0 && (
              <div className="mb-4 space-y-2">
                <span className="text-xs text-slate-500 uppercase tracking-wide">
                  What we learned ({answeredQuestions.length} questions answered)
                </span>
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
            )}

            {/* Optimized prompt */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-emerald-400">
                  Your Optimized Prompt
                </label>
                <button
                  onClick={handleCopy}
                  className="text-sm text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  Copy to clipboard
                </button>
              </div>
              <div className="rounded-lg bg-slate-800 border border-emerald-700/50 px-4 py-3 text-white whitespace-pre-wrap">
                {cleanPrompt}
              </div>
            </div>

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
