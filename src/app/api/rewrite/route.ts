import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GROK_EXPERTISE = `You are an expert on Grok Imagine's image-to-video AI model (by xAI, powered by the Aurora engine). Your knowledge is current as of March 2026.

MODEL VERSION: Grok Imagine 1.0 (February 2026), with Extend from Frame (March 2, 2026) and multi-image reference support (up to 7 images).

CRITICAL OUTPUT RULES — THE PROMPT YOU GENERATE MUST:
- Be 50-150 words (the sweet spot). Never exceed 200 words.
- Front-load the most important details in the FIRST 20-30 words — Grok prioritizes the beginning.
- Be written in natural language like a scene description, NOT keyword stacking.
- Structure as: Subject + Action + Setting + Camera + Lighting/Mood
- For simple scenes: one subject + one main action + one camera move works best.
- For multi-beat sequences: list actions in order. Grok handles sequential actions well.
- Use "camera switch" or "cut to" for transition cues if needed.
- End with an AUDIO: section describing sound (music, effects, ambient, dialogue).
- Focus on ONE core concept per prompt (e.g. "loneliness in a snowy village" or "joy in a sunlit meadow")

PROMPT STRUCTURE (5 layers — strong prompts touch at least 3):
1. Scene — what's happening (subject + single action)
2. Camera — how it's filmed (one camera move or "static/locked shot")
3. Style/lighting — how it looks (color, atmosphere, time of day)
4. Motion — how things move (speed, quality of movement)
5. Audio — what we hear (Grok generates native synchronized audio)

IMAGE-TO-VIDEO SPECIFIC:
- Do NOT re-describe what's in the image — the model already sees it. Focus on MOTION and CAMERA.
- Do NOT contradict the source image — match your prompt to what's actually there.
- Focus on what should CHANGE: the action, the camera movement, the atmosphere.
- Mention prominent features to anchor subjects: "the old man wearing glasses" or "the woman in the red jacket"
- Be specific about motion intensity — the model can't infer degree of motion from a still image
- The model CAN introduce new elements not in the image (people, creatures, objects entering the scene)
- Community tip: darker/moodier base images tend to produce better I2V results

WHAT WORKS WELL:
- "Shot on [Camera]" trick: "shot on Fujifilm XT4" or "shot on ARRI Alexa" gives better cinematic direction than "high quality"
- Cinematic framing terms: wide establishing shot, low-angle shot, close-up, over-the-shoulder, shallow depth of field
- Specific camera movements: slow pan right, dolly zoom in, aerial tracking shot, handheld — but only ONE per prompt
- Emotional tone words: "nostalgic," "melancholic," "electric," "tense," "dreamlike" (NOT generic words like "happy," "cool," "nice")
- Be color-specific: "electric blue and hot pink" beats "colorful." "Charcoal gray fading to black" beats "dark."
- Specific action verbs: "gyrates hips slowly" beats "moves." "Hair gently sways" beats "hair moves."
- Atmosphere cues: "soft morning light," "autumn leaves," "rainy mood," time of day, weather, emotional energy
- Artistic language: "bokeh," "wide-angle shot," "watercolor texture," "dreamlike haze"
- Frame rate hints: 24fps for cinematic, 30fps for natural motion, 60fps for slow-motion
- Audio cues: Grok generates NATIVE synchronized AUDIO with every video. Always include audio direction. You can add a separate "AUDIO:" section at the end of the prompt for clarity.
- Dialogue and lip-sync: Grok handles lip-sync for dialogue and singing. Use short dialogue in prompts: "a quiet whisper: 'We made it.'"
- Use positive descriptions only — negative prompts are completely ignored by Grok. Describe what you want, never what you don't want.

MULTI-BEAT SEQUENCES:
- Grok handles multi-beat action sequences well. List actions in order: "The athlete crouches at the starting line, then explodes forward, arms pumping powerfully."
- You can describe actions for multiple subjects: "The teacher lectures in the background while the student turns away in the foreground."
- Use "camera switch" or "cut to" for transition cues between shots within one generation.

AUDIO CAPABILITIES:
- Grok generates audio NATIVELY alongside video — music, sound effects, ambient audio, and even dialogue/voiceover.
- Lip-sync works for dialogue and singing when characters are visible.
- You can add an "AUDIO:" section at the end of prompts for clarity.
- Short dialogue works: "a quiet whisper: 'We made it.'" or "urgent shout: 'Stop him!'"
- Background music: "with upbeat electronic music" or "dramatic orchestral score"
- Sound effects: "footsteps on gravel," "engine revving," "glass shattering"

INTENSITY MODIFIERS — USE THEM:
- Without modifiers, Grok fills in its own interpretation which may be too subtle.
- Exaggerate slightly: "car passing" → "car racing past at high speed"
- "wings flapping" → "wings flapping with massive amplitude"
- Use specific action verbs: "surges," "unfurls," "shatters," "drifts" beat "moves" or "goes"

WHAT CONFUSES GROK / WHAT TO AVOID:
- Re-describing the image in image-to-video mode — the model already sees it, focus on MOTION
- Contradicting the source image — match your prompt to what's actually in the photo
- Tag stacking ("knight, castle, epic, 8K, cinematic") — write natural sentences with intent instead
- Negative prompts — they are IGNORED completely. Describe what you want instead.
- Fine temporal control — "at 2 seconds, the ball bounces" does NOT work
- Text rendering in video — new text generated by the model is virtually guaranteed to be garbled (but existing text in the source image persists, and can be read aloud via voice)
- Overly long prompts — results in hazy subjects, odd proportions, misplaced objects
- Contradictory instructions ("zoom in and zoom out simultaneously")
- Vague motion — "the thing moves" is bad. Use specific verbs with intensity modifiers.

TECHNICAL SPECS (as of March 2026):
- Output duration: up to 10 seconds per clip in-app (15 seconds via API)
- Can chain clips using "Extend from Frame" — uses final frame as anchor for next clip
- Resolution: 720p max (480p also available)
- Native synchronized audio on every generation
- Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3
- Generation speed: ~30 seconds
- Faces and hands can warp or distort, especially with movement
- The source image anchors the first frame but the model may drift from details as video progresses
- Quality degrades after 2-3 chained extensions
- Pricing: ~$0.05/second via API (~$0.50 for a 10-second clip)`;

const WAN_EXPERTISE = `You are an expert on the Wan 2.5 image-to-video AI model (by Alibaba, available via DashScope). Your knowledge is current as of March 2026.

MODEL: Wan 2.5 — open-source (Apache 2.0), advanced image-to-video and text-to-video generation.

KEY CAPABILITIES:
- One-pass audio/video sync: Creates fully synchronized video with audio, voiceover, and lip-sync from a single prompt — no separate recording or manual alignment needed.
- Native 1080p HD cinematic quality at 24fps.
- Up to 10 seconds per generation.
- Physics simulation engine for realistic object interactions.
- Character/object consistency across all frames — reduced flicker and distortion vs older versions.
- Smooth, natural motion with fluid transitions.
- Multilingual support (English and Chinese prompts).
- Supports 480p, 720p, and 1080p output resolutions.

PROMPT STRUCTURE (for best results):
1. Subject identity (what is in the frame)
2. Motion description (what moves, what stays still)
3. Camera behavior (how you are "filming" it)
4. Style and atmosphere (lighting, mood, color)
5. Audio/dialogue direction

- Text-to-video: Subject + Scene + Motion + Aesthetic Control + Audio
- Image-to-video: Motion Description + Camera Movement + Audio ONLY (the image provides subject, scene, and style)
- Optimal length: 80-120 words
- Use concrete, specific verbs: "hair gently sways in the breeze" NOT "hair moves"
- Use cinematography terms: "Slow dolly in, center-framed, steady" beats "Camera moves closer"
- Use adverbs for pace control: "quickly," "slowly," "gently"

AUDIO & DIALOGUE CAPABILITIES:
- Wan 2.5 generates synchronized audio natively alongside video.
- Lip-sync for dialogue: Specify dialog with speaker identification — "Character A: 'We have to keep moving.'"
- Ambient sounds: "soft rain tapping on windows with distant thunder"
- When silence is preferred: explicitly mention "no dialog" in the prompt.
- Music and sound effects can be described naturally in the prompt.

IMAGE-TO-VIDEO SPECIFIC:
- Describe MOTION, not appearance — the image already provides the visual
- Do NOT re-describe the subject — this causes CONFLICTS between prompt and reference image
- Focus almost entirely on: how things MOVE, how the CAMERA behaves, and AUDIO
- Keep it shorter than text-to-video prompts
- Image quality = 70% of output success. Resolution sweet spot: 768px to 2K.
- Match input aspect ratio to output (e.g., 1080x1920 for 9:16). Mismatches cause warping.
- Include complete limbs or crop at natural breaks (waist, shoulders). Cropped limbs cause phantom anatomy.
- Keep motion slow and controlled. Fast/aggressive motion produces smearing.
- One or two camera moves MAX per generation. Combining dolly + pan + zoom = chaos.
- For static camera: explicitly say "static shot" or "fixed shot"

WHAT WORKS WELL:
- Precise cinematography terms: pan, tilt, dolly in, tracking shot, orbit, push-in, pull back
- Speed modifiers: "slowly," "quickly," "time-lapse," "slow motion"
- Lighting descriptors: sunny, moonlit, fluorescent, firelight, overcast, golden hour
- Shot size: close-up, medium shot, wide shot, extreme close-up, bird's eye
- Camera angle: over-the-shoulder, high angle, low angle, Dutch angle, aerial
- Color tone: warm, cool, saturated, desaturated
- Style keywords: cinematic, vintage film look, shallow depth of field, motion blur
- Separating foreground/background motion: "Subject remains still with subtle breathing, background trees swaying gently, camera static"
- Dialogue with lip-sync: "Character says: 'Let's go'" with speaker identification
- Ambient audio descriptions: "crackling fire, distant thunder, soft piano music"

NEGATIVE PROMPTS (Wan supports these — they are important for quality):
- Universal starter: "low quality, blurry, distorted faces, unnatural movement, text, watermarks, shaky camera"
- Anti-flicker: "flicker, temporal flicker, strobe, shimmer, jitter"
- Anti-face-drift: "identity drift, face morphing, off-model, expression drift"
- Anti-blur: "soft focus, motion smear, ghosting, out of focus"
- Anti-artifact: "extra fingers, deformed hands, duplicate limbs, bad anatomy"
- For silence: explicitly say "no dialog" in the prompt
- Pair negatives with strong structured positive prompts

WHAT CONFUSES WAN / WHAT TO AVOID:
- OVERLOADING MOTION: multiple simultaneous motions produce artifacts. Limit to ONE primary motion + ONE optional secondary.
- Dolly-out reliably FAILS (dolly-in works fine)
- Panning does NOT respect left/right direction — direction is basically random
- Whip pans (fast camera motion) do NOT work
- Camera roll is nearly impossible to achieve
- Conflicting styles: "cinematic + cartoon + watercolor" confuses the model
- Vague prompts: the model fills gaps with random guesses that compound across frames
- Hands in motion: artifact-prone. Best when slightly out of focus, natural poses, or partially occluded.
- New text/logos generated in scene: warp consistently (but existing text in source image persists)

TECHNICAL SPECS:
- Output: up to 10 seconds at 480p, 720p, or 1080p, 24fps
- Native synchronized audio + lip-sync on every generation
- Physics simulation for realistic interactions
- Consistent characters across frames
- Open-source under Apache 2.0 license
- Supports English and Chinese prompts`;

export const maxDuration = 60;

interface MessageContent {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
}

async function callKieAI(content: string | MessageContent[], retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch("https://api.kie.ai/claude/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        stream: false,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      let errorMsg = `API returned ${res.status}`;
      try {
        const errorData = await res.json();
        errorMsg = errorData.msg || errorData.error?.message || errorMsg;
      } catch { /* ignore parse errors */ }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();

    if (data.code && data.code !== 200) {
      if (attempt < retries && data.code === 500) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(data.msg || `API error code ${data.code}`);
    }

    return data.content?.[0]?.text || "";
  }
  throw new Error("API request failed after retries");
}

function buildContent(textPrompt: string, imageDataUrl?: string): string | MessageContent[] {
  if (!imageDataUrl) return textPrompt;

  // Parse data URL: "data:image/jpeg;base64,/9j/4AAQ..."
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return textPrompt;

  const mediaType = match[1];
  const base64Data = match[2];

  return [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data,
      },
    },
    { type: "text", text: textPrompt },
  ];
}

export async function POST(request: NextRequest) {
  try {
    // Auth check — protect the API from unauthenticated access
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { model: rawModel, action, prompt, questions, image, duration, aspect } = await request.json();

    if (!prompt && !image) {
      return Response.json({ error: "Please provide a prompt or upload an image" }, { status: 400 });
    }

    // For "auto" model (used by generate), we'll pick the best model below
    // For other actions, default to grok if auto is passed
    let model = rawModel;
    if (model === "auto" && action !== "generate") {
      model = "grok";
    }
    if (model !== "grok" && model !== "wan" && model !== "auto") {
      return Response.json({ error: "Model must be 'grok', 'wan', or 'auto'" }, { status: 400 });
    }

    const resolvedModel = model === "auto" ? "grok" : model; // temporary default for shared setup
    const clipDuration = resolvedModel === "grok" ? 8 : (duration === 10 ? 10 : 5);
    const aspectRatio = aspect === "9:16" ? "9:16" : (aspect === "16:9" ? "16:9" : null);

    const modelName = resolvedModel === "grok" ? "Grok" : "Wan";
    const expertise = resolvedModel === "grok" ? GROK_EXPERTISE : WAN_EXPERTISE;

    // Build context from previous Q&A rounds
    let qaContext = "";
    if (questions && Array.isArray(questions) && questions.length > 0) {
      qaContext = "\n\nPrevious clarifications from the user:\n";
      for (const q of questions) {
        qaContext += `- "${q.question}" → ${q.answer}\n`;
      }
    }

    const imageContext = image
      ? `\n\nIMPORTANT: The user has uploaded a reference image (shown above). Analyze this image carefully. The prompt they write is meant to describe how this image should be ANIMATED into a video using ${modelName}'s image-to-video feature.

Common mistakes users make with image-to-video prompts:
- Writing text/dialogue they want the person to SAY (these models animate images, they don't add speech or text overlays)
- Writing marketing copy or captions instead of motion/animation descriptions
- Describing a completely different scene that doesn't match the uploaded image
- Forgetting to describe HOW the image should move/animate

If you detect a mismatch between the image and the prompt (e.g. the prompt contains dialogue, marketing text, or doesn't describe animation), you MUST address this in your questions or output.`
      : "";

    if (action === "analyze") {
      const hasPrompt = prompt && prompt.trim().length > 0;
      const imageOnlyMode = !hasPrompt && image;

      let analyzeIntro: string;
      const questionCount = questions ? questions.length : 0;
      if (imageOnlyMode) {
        analyzeIntro = `${expertise}

A user wants to create an image-to-video prompt for ${modelName}. They uploaded a reference image (shown above) but did NOT write any prompt — they want YOUR help to figure out what to do with this image. Think of this like a game of "Guess Who" — you're narrowing down exactly what they envision through yes/no questions.

LOOK AT THE IMAGE CAREFULLY. Describe to yourself what you see — who/what is in it, the setting, the mood, what's interesting about it. Then ask questions that help narrow down their creative vision.

TEXT IN IMAGE CHECK: Look carefully — does the image contain any visible text, words, quotes, captions, or speech bubbles? If YES, you MUST ask early (Round 1 or 2): "Your image has text in it — should a voice narrate or read that text aloud in the video?" This is important because ${modelName} may auto-generate a voiceover of visible text. If the user says NO, the generated prompt must include "no voice, no narration, no speech" in the audio layer. If YES, include "a voice reads the on-screen text aloud" in the audio layer.${qaContext}

${questionCount === 0 ? `ROUND 1 — START BROAD & CREATIVE:
This is the FIRST round of questions. You know NOTHING about what they want yet. Start with the big creative questions:
- Is this meant to be wild/surreal/fantastical? (e.g., monsters appearing, impossible physics, magical effects)
- Is this meant to be realistic/natural? (e.g., natural movement, wind, breathing, subtle motion)
- Is this meant to be funny/comedic?
- Is this meant to be dramatic/cinematic/serious?
- Should something unexpected happen in the scene?

Generate 4-5 questions. Focus ENTIRELY on creative direction and vibe. Do NOT ask about technical details like camera angles or lighting yet — that comes later.

IMPORTANT: Be SPECIFIC to what you see in the image. If you see a person holding a fish, ask about the fish. If you see a landscape, ask about weather or time changes. Reference actual elements from their image.` :
questionCount < 8 ? `ROUND 2-3 — NARROW THE CREATIVE DIRECTION:
Based on their answers so far, you're starting to understand their vibe. Now dig deeper:
- If they want something wild: what KIND of wild? Supernatural? Sci-fi? Horror? Comedy?
- If they want something realistic: what specific motion? Wind? Walking? Turning?
- What should the main ACTION be? What moves? What changes?
- Start introducing some style questions (mood, atmosphere, color feel)
- Still keep it creative and fun — don't get too technical yet

Generate 3-5 NEW questions based on what you've learned. Reference their previous answers.` :
questionCount < 15 ? `ROUND 4+ — GET SPECIFIC:
You should have a good sense of the creative direction by now. Start narrowing down specifics:
- Exactly what motion/action happens?
- How fast/slow should it be?
- Camera movement preferences
- Mood and atmosphere details
- Style (cinematic, raw, dreamy, etc.)
- Any finishing details that would make the prompt perfect

Generate 3-4 NEW specific questions.` :
`FINAL ROUNDS — POLISH:
You've asked a lot of questions. Focus on any remaining gaps:
- Confirm your understanding of the key action
- Any last details about style, speed, or mood
- Ask if there's anything they want that you haven't covered

Generate 2-3 final questions.`}

Do NOT repeat ANY previously asked questions. Each round must ask NEW questions that build on previous answers.`;
      } else {
        analyzeIntro = `${expertise}

A user wants to create an image-to-video prompt for ${modelName}. Their initial idea is:

"${prompt}"${imageContext}${qaContext}

TEXT IN IMAGE CHECK: Look carefully at the uploaded image — does it contain any visible text, words, quotes, captions, or speech bubbles? If YES, one of your questions MUST be: "Your image has text in it — should a voice narrate or read that text aloud in the video?" This is important because ${modelName} may auto-generate a voiceover of visible text. If the user says NO, the generated prompt must include "no voice, no narration, no speech" in the audio layer. If YES, include "a voice reads the on-screen text aloud" in the audio layer.

Based on your expertise with ${modelName}, generate 3-5 clarifying questions that will help you understand what they REALLY want. The user can answer Yes, No, or type a custom response. Focus on:
- Ambiguities in their description that could lead to unexpected results
- Important details they haven't specified that ${modelName} needs (camera, lighting, style, mood, motion)
- Potential misunderstandings or things ${modelName} might interpret differently than intended
- Creative choices that would significantly change the output
${image ? "- WHETHER THE PROMPT ACTUALLY MAKES SENSE FOR IMAGE-TO-VIDEO (if it contains dialogue, marketing text, or doesn't describe animation, your first question should address this and help the user understand what image-to-video prompts actually do)" : ""}

${questions && questions.length > 0 ? "IMPORTANT: Do NOT repeat any questions already asked above. Ask NEW questions that dig deeper based on what we now know from their previous answers." : ""}`;
      }

      const aspectContext = aspectRatio ? `\nThe video will be rendered in ${aspectRatio} format${aspectRatio === "9:16" ? " (vertical/portrait — like a phone screen, TikTok/Reels style)" : " (wide/landscape — cinematic widescreen)"}. Keep this in mind when asking about composition and camera movement.` : "";

      const textPrompt = `${analyzeIntro}${aspectContext}

CRITICAL QUESTION FORMAT RULES — FOLLOW THESE EXACTLY:
1. Every question MUST be a simple YES/NO question about ONE specific thing.
2. THE WORD "or" IS COMPLETELY BANNED FROM ALL QUESTIONS. Not a single question may contain the word "or". This rule has ZERO exceptions.
   BANNED — any question containing "or": ❌❌❌
   - "Should the dog be realistic or playful?" ❌ BANNED
   - "Do you want X or Y?" ❌ BANNED
   - "Should it be slow or fast?" ❌ BANNED
   - "more playful and domesticated or wild?" ❌ BANNED
   HOW TO FIX: Pick ONE option. Ask about ONLY that one thing:
   - "Should the dog look like a wild wilderness dog?" ✅
   - "Do you want the motion to be slow and gentle?" ✅
   - "Should this have a playful, fun energy?" ✅
3. Keep questions concise — one sentence, one concept.
4. VALIDATION: Go through each question you generated. If it contains " or " anywhere, DELETE IT and write a new yes/no question about just one of the options.

READINESS ASSESSMENT: Based on everything so far, decide if you have ENOUGH information to write an excellent ${modelName} prompt.
${imageOnlyMode ? `For image-only mode, you need MORE info before you're ready — since there's no user prompt to start from, you need at MINIMUM: (1) a clear creative direction/vibe, (2) a specific main action or event, (3) some sense of mood/style. Do NOT set readyToGenerate to true until you've asked at least 6-8 questions and have a clear picture. It's better to ask too many questions than to generate a vague prompt.` : `You need at minimum: a clear subject/scene, motion intent, and camera/style direction.`}
If you have all of these, set "readyToGenerate" to true. If critical details are still missing, set it to false.

Return ONLY a JSON object with this exact format (no markdown, no code blocks):
{"questions":["question 1","question 2","question 3"],"readyToGenerate":false}

Example: {"questions":["Should the camera slowly push in toward the subject?","Do you want a cinematic film look?","Should the lighting feel warm and golden?"],"readyToGenerate":false}`;

      const text = await callKieAI(buildContent(textPrompt, image));

      let parsed: { questions: string[]; readyToGenerate: boolean };
      try {
        const match = text.match(/\{[\s\S]*\}/);
        const obj = match ? JSON.parse(match[0]) : JSON.parse(text);
        parsed = {
          questions: Array.isArray(obj.questions) ? obj.questions : [],
          readyToGenerate: !!obj.readyToGenerate,
        };
      } catch {
        // Fallback: treat as array of questions
        try {
          const arrMatch = text.match(/\[[\s\S]*\]/);
          const arr = arrMatch ? JSON.parse(arrMatch[0]) : [];
          parsed = { questions: arr, readyToGenerate: false };
        } catch {
          parsed = {
            questions: text
              .split("\n")
              .map((l: string) => l.replace(/^\d+\.\s*/, "").replace(/^["']|["']$/g, "").trim())
              .filter((l: string) => l.length > 10)
              .slice(0, 5),
            readyToGenerate: false,
          };
        }
      }

      // Post-process: fix any "A or B?" choice questions that slipped through
      // Aggressively catch any question with " or " that presents alternatives
      parsed.questions = parsed.questions.map((q: string) => {
        // Skip if no " or " present
        if (!/ or /i.test(q)) return q;

        // Allow safe uses of "or": "2 or 3", "one or two", "or more"
        const safeOr = /\b\d+\s+or\s+\d+\b|\bone\s+or\s+two\b|\bor\s+more\b|\bor\s+less\b|\bor\s+not\b/i;
        if (safeOr.test(q) && (q.match(/ or /gi) || []).length === 1) return q;

        // This question contains " or " presenting alternatives — take the first half
        // Find the " or " and keep everything before it, turn into a yes/no question
        const orIndex = q.toLowerCase().indexOf(" or ");
        let firstPart = q.substring(0, orIndex).trim();
        // Clean up trailing conjunctions, parentheticals
        firstPart = firstPart.replace(/\s*\([^)]*$/, "").replace(/,\s*$/, "");
        if (!firstPart.endsWith("?")) firstPart += "?";
        return firstPart;
      });

      // Safety: filter out any questions that are too short (< 20 chars) as they were likely truncated
      parsed.questions = parsed.questions.filter((q: string) => q.length >= 20);

      return Response.json({ questions: parsed.questions, readyToGenerate: parsed.readyToGenerate });

    } else if (action === "generate") {
      // Step 0: If model is "auto", pick the best model based on the prompt content
      let genModel: "grok" | "wan" = "grok";
      let genDuration = 8;
      if (rawModel === "auto") {
        const pickPrompt = `You are an expert on AI image-to-video models. Given a user's prompt (and optional image), pick the BEST model and duration.

MODELS:
- Grok: Best for multi-beat sequences, scene transitions, complex camera work, dramatic/cinematic scenes, native audio with lip-sync for dialogue AND singing. Duration: always 8 seconds. Max 720p.
- Wan: Best for single smooth motions, physics simulations, realistic natural movement, high quality output. Duration: 5 seconds (simple motion) or 10 seconds (more complex). 1080p at 24fps.

GUIDELINES:
- If the prompt describes dialogue, singing, or speaking → Grok (superior lip-sync)
- If the prompt describes multiple scenes, cuts, or transitions → Grok (multi-beat support)
- If the prompt describes simple/subtle motion (wind, water, breathing) → Wan 5s
- If the prompt describes a single continuous action with detail → Wan 10s
- If the prompt describes dramatic cinematic sequences → Grok
- If the prompt emphasizes visual quality/resolution → Wan (1080p vs 720p)
- If the prompt describes physics-based interactions → Wan (physics engine)
- When in doubt, pick Grok 8s — it's the most versatile.

USER'S PROMPT: "${prompt || "(image only — no text prompt)"}"
${questions && questions.length > 0 ? `\nQ&A CONTEXT:\n${questions.map((q: { question: string; answer: string }) => `- "${q.question}" → ${q.answer}`).join("\n")}` : ""}

Return ONLY a JSON object: {"model":"grok" or "wan","duration":5 or 8 or 10,"reason":"one sentence why"}`;

        const pickResult = await callKieAI(image ? buildContent(pickPrompt, image) : pickPrompt);
        try {
          const pickMatch = pickResult.match(/\{[\s\S]*\}/);
          const pickParsed = pickMatch ? JSON.parse(pickMatch[0]) : JSON.parse(pickResult);
          if (pickParsed.model === "wan" || pickParsed.model === "grok") {
            genModel = pickParsed.model;
          }
          if (pickParsed.duration === 5 || pickParsed.duration === 8 || pickParsed.duration === 10) {
            genDuration = pickParsed.duration;
          } else {
            genDuration = genModel === "grok" ? 8 : 5;
          }
        } catch {
          // Default to grok 8s
        }
      } else {
        genModel = model;
        genDuration = clipDuration;
      }

      const genModelName = genModel === "grok" ? "Grok" : "Wan";
      const genExpertise = genModel === "grok" ? GROK_EXPERTISE : WAN_EXPERTISE;

      const hasPrompt = prompt && prompt.trim().length > 0;
      const genImageContext = image
        ? `\n\nIMPORTANT: The user has uploaded a reference image (shown above). Analyze this image carefully. The prompt they write is meant to describe how this image should be ANIMATED into a video using ${genModelName}'s image-to-video feature.

Common mistakes users make with image-to-video prompts:
- Writing text/dialogue they want the person to SAY (these models animate images, they don't add speech or text overlays)
- Writing marketing copy or captions instead of motion/animation descriptions
- Describing a completely different scene that doesn't match the uploaded image

The uploaded image IS the starting frame. The prompt describes what HAPPENS NEXT — the motion, camera movement, animation, and audio.`
        : "";
      const promptIntro = hasPrompt
        ? `A user wants to create an image-to-video prompt for ${genModelName}. Their initial idea is:\n\n"${prompt}"${genImageContext}${qaContext}`
        : `A user wants to create an image-to-video prompt for ${genModelName}. They uploaded a reference image (shown above) but did not write their own prompt. Based on the image and their answers to your questions, create the best possible prompt.${qaContext}`;

      const textPrompt = `${genExpertise}

${promptIntro}

Now write the BEST possible ${genModelName} image-to-video prompt based on everything you know about what they want. Apply all your expertise about what works well with ${genModelName}. Make it detailed, specific, and optimized for the best possible output. Fix any issues that would confuse ${genModelName}.

DURATION: The generated video will be ${genDuration} seconds long. Design the prompt for EXACTLY ${genDuration} seconds of action — don't describe more action than can realistically happen in ${genDuration} seconds. ${genDuration <= 5 ? "With only 5 seconds, keep it to ONE simple motion or change." : genDuration <= 8 ? "With 8 seconds, you can fit one clear action with some buildup." : "With 10 seconds, you have room for one primary action with a setup and payoff."}
${aspectRatio ? `\nASPECT RATIO: The video will be rendered in ${aspectRatio} format. ${aspectRatio === "16:9" ? "This is WIDE/LANDSCAPE — optimize for horizontal compositions, wide establishing shots, lateral camera movements (pans, tracking shots), and subjects positioned with horizontal breathing room. Think cinematic widescreen." : "This is VERTICAL/PORTRAIT (like a phone screen) — optimize for tall compositions, vertically-oriented subjects, upward/downward camera movements (tilts, crane shots), and tight framing on faces or full-body shots. Avoid wide landscape compositions that would feel cramped vertically. Think TikTok/Reels/Shorts framing."}` : ""}

THE #1 RULE — PRESERVE THE USER'S CORE IDEA:
The user's main concept/action MUST appear in the generated prompt. NEVER remove, water down, or replace the user's core idea with something safer or simpler. If they want "a fish swallows a man whole," the prompt MUST describe a fish swallowing a man whole. If they want something surreal, fantastical, or physically impossible, INCLUDE IT — your job is to express their idea in the best possible way for ${genModelName}, NOT to decide their idea is too hard and replace it with something generic. Optimize HOW it's described, never WHAT is described.

FORMATTING RULES FOR THE OUTPUT PROMPT:
- Write ONE single prompt. Do NOT split into multiple clips unless the user specifically asked for it.
- The prompt must be 50-150 words. Never exceed 200 words.
- Front-load the key subject and action in the first 20-30 words.
- Structure as: Subject + Action + Setting + Camera + Lighting/Mood, then end with AUDIO: section.
- Use specific action verbs with intensity modifiers ("surges," "unfurls," "shatters" not "moves").
- Use positive descriptions only — negative prompts are completely IGNORED by ${genModelName}.
- For multi-beat action, list actions in order. Use "camera switch" or "cut to" for transitions.
- Always end with "AUDIO:" section describing music, sound effects, ambient sounds, and/or dialogue.

COMPLEXITY CHECK: If the user's idea involves WAY too much action for a single ${genDuration}-second clip, add a note at the very end on a new line starting with "⚠️ TIP:" suggesting the action might be a lot for ${genDuration} seconds, and the user could split this into separate clip prompts for better results. Do NOT mention "Extend from Frame" or any specific tool features. But STILL write the single prompt above the tip — let the user decide if they want to split it.

${image ? `CRITICAL: The prompt MUST describe how the uploaded image should ANIMATE into video. Describe motion, camera movement, and changes.

TEXT/VOICE HANDLING: Check the Q&A answers above — if the user was asked about narrating text in the image:
- If they said YES to voice narration: include "a voice reads the on-screen text aloud" or similar in the audio layer
- If they said NO to voice narration: include "no voice, no narration, no speech — ambient sounds only" in the audio layer
- If they weren't asked (no text in image): handle audio normally with ambient sounds
This is important because ${genModelName} may auto-generate voiceovers of visible text in the source image.` : ""}

Return ONLY a JSON object with this exact format (no markdown, no code blocks):
{"prompt":"the optimized prompt text here","summary":"1-2 sentence summary of what was improved from the original idea","warning":"only include this field if the user's original prompt asked for something the AI model cannot do well"}

RULES FOR THE JSON:
- "prompt" contains the full optimized prompt text. If there's a complexity tip, add it on a new line starting with "⚠️ TIP:" INSIDE the prompt field.
- "summary" is 1-2 sentences explaining what you improved, enhanced, or added compared to the user's original idea. Be specific about what was changed. If there was no original prompt (image-only mode), describe the creative choices you made.
- "warning" — ONLY include this field if the user's original idea asked for something ${genModelName} can't do or struggles with. Examples of things that need a warning:
  - Requesting legible text to appear, be written, or be read in the video (AI video models render text as garbled/illegible)
  - Requesting specific words to appear on screen as text overlays or captions
  - Requesting multiple scene changes or transitions (these models make a single continuous clip)
  - Requesting detailed hand/finger close-ups (often renders with distorted fingers)
  - Requesting large crowds with individual detail (faces blur and distort)
  - Requesting major shape-shifting or transformation effects
  If the user's prompt IS achievable, do NOT include the warning field at all. The warning should be a short, friendly 1-2 sentence explanation of what can't be done and what you changed it to instead.`;

      const text = await callKieAI(buildContent(textPrompt, image));

      // Try to parse as JSON for structured response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
        return Response.json({
          rewritten: parsed.prompt || text,
          summary: parsed.summary || null,
          warning: parsed.warning || null,
          model: genModel,
          duration: genDuration,
        });
      } catch {
        // Fallback: treat as plain text (backward compatible)
        return Response.json({ rewritten: text, model: genModel, duration: genDuration });
      }

    } else if (action === "split") {
      const clipDuration = duration || (model === "wan" ? 5 : 8);
      const textPrompt = `${expertise}

You previously wrote this single prompt for a ${modelName} image-to-video generation:

"${prompt}"

The user wants to split this into MULTIPLE shorter clips because the action is too complex for a single ${clipDuration}-second clip.

Split the prompt into 2-3 separate clip prompts. Each clip should:
- Be labeled "Clip 1:", "Clip 2:", etc. on its own line
- Contain ONE primary action that fits naturally in ${clipDuration} seconds
- Be 50-120 words
- Pick up where the previous clip left off (so they can be generated in sequence)
- Front-load the key action in the first 20 words
- Include camera, lighting, and audio descriptions
- Use positive descriptions only (never "no X" or "without X")

Return ONLY the clip prompts with their labels. No explanations or commentary.`;

      const rewritten = await callKieAI(textPrompt);
      return Response.json({ rewritten });

    } else if (action === "surprise") {
      const hasImage = !!image;
      const hasPrompt = prompt && prompt.trim() !== "surprise" && prompt.trim().length > 0;

      const aspectInstructions = aspectRatio ? `ASPECT RATIO: ${aspectRatio} format. ${aspectRatio === "16:9" ? "Optimize for wide/landscape cinematic compositions." : "Optimize for vertical/portrait phone-screen compositions."}` : "";

      const sharedRequirements = `Requirements:
- 80-120 words
- ONE primary action that fits in ${clipDuration} seconds
- Front-load the subject and action
- Include camera direction, lighting, and audio
- Be creative and unexpected — surprise the user with something they wouldn't think of themselves
- Do NOT add speech, dialogue, or text overlays — only visual motion`;

      let textPrompt: string;

      if (hasPrompt && hasImage) {
        // Text + Image: use both as creative inspiration
        textPrompt = `${expertise}

The user has uploaded an image (shown above) and provided this idea: "${prompt}"

Analyze the image carefully and combine it with their text idea to generate a CREATIVE and visually stunning image-to-video prompt for ${modelName}. Use both the image content AND their text as inspiration, but take it in a surprising, unexpected creative direction they wouldn't think of themselves.

${aspectInstructions}

DURATION: Design for ${clipDuration} seconds of action.

${sharedRequirements}
- The animation must start from this uploaded image
- Incorporate the user's text idea but elevate it with unexpected creative choices

Pick a category that best fits from: cinematic nature, dramatic action, ethereal portrait, surreal/fantasy, product shot, architectural, underwater, space/sci-fi, historical moment, or abstract art.

Return ONLY a JSON object (no markdown):
{"prompt":"the prompt text","category":"the category you picked"}`;
      } else if (hasImage) {
        // Image only: analyze and create from the image
        textPrompt = `${expertise}

The user has uploaded an image (shown above). Analyze this image carefully — identify the subject, setting, colors, mood, and any notable details.

Now generate a CREATIVE and visually stunning image-to-video prompt for ${modelName} that describes how THIS SPECIFIC IMAGE should animate into an amazing video. Surprise the user with an unexpected creative direction they wouldn't think of themselves.

${aspectInstructions}

DURATION: Design for ${clipDuration} seconds of action.

${sharedRequirements}
- Describe motion, camera movement, lighting changes, and atmosphere that bring THIS image to life
- Do NOT describe a completely different scene — the animation must start from this image

Pick a category that best fits the image from: cinematic nature, dramatic action, ethereal portrait, surreal/fantasy, product shot, architectural, underwater, space/sci-fi, historical moment, or abstract art.

Return ONLY a JSON object (no markdown):
{"prompt":"the prompt text","category":"the category you picked"}`;
      } else if (hasPrompt) {
        // Text only: use the text as creative seed
        textPrompt = `${expertise}

The user provided this idea: "${prompt}"

Use their idea as a creative starting point, but take it in a SURPRISING and unexpected direction to generate a visually stunning image-to-video prompt for ${modelName}. Don't just polish their idea — reimagine it, amplify it, or twist it into something they wouldn't expect.

${aspectInstructions}

DURATION: Design for ${clipDuration} seconds of action.

${sharedRequirements}
- Be specific and vivid — no generic descriptions
- The prompt should feel inspired by the user's idea but elevated far beyond it

Pick a category that best fits from: cinematic nature, dramatic action, ethereal portrait, surreal/fantasy, product shot, architectural, underwater, space/sci-fi, historical moment, or abstract art.

Return ONLY a JSON object (no markdown):
{"prompt":"the prompt text","category":"the category you picked"}`;
      } else {
        // Fully random
        textPrompt = `${expertise}

Generate a RANDOM, creative, and visually stunning image-to-video prompt for ${modelName}. Surprise the user with something they wouldn't think of themselves.

Pick a random category: cinematic nature, dramatic action, ethereal portrait, surreal/fantasy, product shot, architectural, underwater, space/sci-fi, historical moment, or abstract art.

${aspectInstructions}

DURATION: Design for ${clipDuration} seconds of action.

${sharedRequirements}
- Be specific and vivid — no generic descriptions
- Make it something that would look AMAZING as a video

Return ONLY a JSON object (no markdown):
{"prompt":"the prompt text","category":"the category you picked"}`;
      }

      const text = await callKieAI(buildContent(textPrompt, image));
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
        return Response.json({
          rewritten: parsed.prompt || text,
          category: parsed.category || "Creative",
        });
      } catch {
        return Response.json({ rewritten: text, category: "Creative" });
      }

    } else if (action === "check") {
      if (!prompt || !prompt.trim()) {
        return Response.json({ error: "Prompt is required for checking" }, { status: 400 });
      }

      const textPrompt = `${expertise}

You are checking whether a user's prompt idea will work well with ${modelName} image-to-video generation.

The user wrote: "${prompt}"
${image ? `They uploaded the reference image shown above. This is the ACTUAL image they want to animate into a video.

STEP 1 — CAREFULLY DESCRIBE WHAT YOU SEE IN THE IMAGE:
Before doing anything else, study the image and list (to yourself) every visible element: people (or lack of people), objects, setting, lighting, mood, text overlays, etc. Be extremely precise — if you only see boots but no person's face or body, note "boots visible, no person visible." If there's text in the image, note exactly what it says.

STEP 2 — COMPARE THE PROMPT TO THE IMAGE:
Go through every noun and subject in the user's prompt and check if it exists in the image:
- "the man" → Is there actually a man visible? Or just boots/hands/partial view?
- Any subject mentioned → Is it in the image or does it need to emerge/appear?

IMPORTANT — TEXT AND VOICE DISTINCTION:
- "reads the text" / "speaks the words" / "narrates" = the user wants someone to READ ALOUD or NARRATE text that's in the image. This IS possible — ${modelName} can generate a person appearing/emerging AND speaking, plus voice audio. This is a VALID and ACHIEVABLE request.
- "text appears" / "write text" / "show words" / "display caption" = the user wants NEW text generated visually on screen. This will NOT work — ${modelName} renders new text as garbled.
- If the image contains text and the user wants it read aloud, even by "a man" who isn't in the image — that IS doable. ${modelName} can introduce a person who emerges into the scene and speaks/narrates. Treat this as a creative prompt that needs the right phrasing, NOT as impossible.

STEP 3 — WRITE YOUR RESPONSE:
- ${modelName} CAN introduce new elements not in the image — people, creatures, objects can EMERGE, APPEAR, or ENTER the scene
- If the user mentions a person not in the image (like "the man reads the text"), don't say it's impossible. Instead, help phrase it so the person APPEARS in the scene (e.g. "a man steps into frame by the campfire and begins speaking")
- If they want existing text READ ALOUD, that's absolutely fine — include voice narration in the audio layer and describe the person speaking
- If they want NEW text to appear visually on screen, warn that it will render as garbled
- Your suggestion must work WITH the image — reference what's visible and describe how new elements enter the scene` : ""}

Analyze their prompt and determine:
1. Is the prompt clear enough for ${modelName} to understand what to generate?
2. If new elements are mentioned, does the prompt describe how they appear in the scene?
3. Is this something ${modelName} can actually do well?
4. Are there any parts that will likely fail or produce poor results?

KNOWN ${modelName} LIMITATIONS:
- Cannot generate NEW legible text on screen — any new text appears garbled
- Faces and hands can warp or distort, especially with movement
- Negative prompts are completely IGNORED — describe what you want, not what you don't
- Fine temporal control doesn't work ("at 2 seconds, X happens")
- Overly long prompts cause hazy subjects and odd proportions
- Video is ${clipDuration} seconds — keep action realistic for that duration

THINGS ${modelName} CAN DO:
- Introduce NEW elements not in the original image (creatures, people, objects emerging/appearing)
- Multi-beat action sequences — list actions in order and Grok handles them well
- Scene transitions using "camera switch" or "cut to" cues
- Speaking, talking, lip-sync for dialogue AND singing
- Short dialogue: "a whisper: 'We made it.'" or "shout: 'Stop!'"
- All standard camera movements (pan, tilt, dolly, tracking, orbit, aerial, handheld)
- Native synchronized audio — music, sound effects, ambient sounds, voiceover
- Natural motion (wind, water, fire, smoke, hair, clothing)
- Character animation and body movement
- Lighting changes, atmospheric effects

Return ONLY a JSON object (no markdown, no code blocks):
If the prompt is good as-is: {"status":"good","message":"Brief encouraging feedback about why this will work well"}
If there are issues: {"status":"warning","message":"Short explanation of the issue — be specific about what's wrong (e.g. 'There's no man in the image — only boots, a campfire, and an RV are visible')","suggestion":"A rewritten version that PRESERVES their creative idea but accurately reflects what's in the image. Only reference subjects/objects actually visible in the image, or explicitly describe new elements EMERGING into the scene. Write as a complete prompt (30-80 words)."}

Keep the message to 1-2 sentences. Be helpful, not discouraging.`;

      const text = await callKieAI(buildContent(textPrompt, image));
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
        return Response.json({
          status: parsed.status || "good",
          message: parsed.message || "Your prompt looks good!",
          suggestion: parsed.suggestion || null,
        });
      } catch {
        return Response.json({ status: "good", message: "Your prompt looks good!", suggestion: null });
      }

    } else if (action === "suggest") {
      if (!image) {
        return Response.json({ error: "Image is required for suggestions" }, { status: 400 });
      }

      const modelLimitations = model === "grok"
        ? `IMPORTANT ${modelName} GUIDELINES — every suggestion MUST follow these rules:
- Structure as: Subject + Action + Setting + Camera + Lighting/Mood.
- ${modelName} handles multi-beat sequences well — list actions in order.
- Use standard cinematic camera language (pan, tilt, dolly, tracking, orbit, aerial, handheld, slow push-in, static).
- Use "camera switch" or "cut to" for transition cues if the scene needs it.
- Use specific action verbs with intensity modifiers — "surges," "unfurls," "shatters" beat "moves."
- ${modelName} generates native audio — include sound direction (music, effects, ambient, even short dialogue with lip-sync).
- End with an AUDIO: section.
- Do NOT re-describe the image — focus on what MOVES and CHANGES.
- Do NOT use negative prompts — they are ignored. Describe what you want instead.
- Each suggestion must fit within ${clipDuration} seconds realistically.`
        : `IMPORTANT ${modelName} GUIDELINES — every suggestion MUST follow these rules:
- Only ONE primary motion/action per suggestion.
- Keep motions realistic and achievable for a ${clipDuration}-second clip.
- ${modelName} works best with clear, direct motion descriptions.
- Use specific action verbs with intensity modifiers.
- Avoid overly complex physics or multiple independent moving subjects.`;

      const textPrompt = `${expertise}

Look at this uploaded image carefully. Study every detail — the subject, their pose/expression, the setting, objects, colors, lighting, mood, and composition.
${prompt ? `
The user has also provided this text to guide your suggestions: "${prompt}"
Use their text as inspiration — your suggestions should build on their idea, exploring different creative variations and angles based on what they described. Every suggestion must relate to their concept while offering a unique creative take.` : ""}
Now suggest 6 CREATIVE and VISUALLY INTERESTING ways this image could be animated into a ${clipDuration}-second video using ${modelName}. Think about what would make each one genuinely exciting to watch — not just technically possible, but captivating and cinematic.${prompt ? " Remember to incorporate the user's text concept into every suggestion." : ""}

${modelLimitations}

${aspectRatio ? `ASPECT RATIO: ${aspectRatio} format.` : ""}

TITLE RULES:
- Each title must be 3-6 words that describe the KEY ACTION or VISUAL EVENT
- The title should instantly tell the user what will happen — not just a vague category
- Good titles: "Ripples Spread From Fishing Line", "Wind Catches His Hat", "Sunset Colors Shift Warm"
- Bad titles: "Gentle Motion", "Camera Pan", "Nature Scene" (too vague!)

PROMPT RULES:
- Write each prompt as a complete, ready-to-use ${modelName} prompt (50-120 words)
- Include the 5 layers: scene/action, camera, style/lighting, motion quality, and audio
- Be SPECIFIC to what's in THIS image — reference actual subjects, objects, colors, and setting
- Each suggestion must be a genuinely DIFFERENT creative concept — vary the focal point, mood, energy level, and style
- Make them interesting! Think about what would look most STUNNING as a video
- Range from subtle/peaceful to dramatic/cinematic across the 6 suggestions

Return ONLY a JSON array (no markdown, no code blocks):
[{"category":"action title here","prompt":"full prompt here"}]`;

      const text = await callKieAI(buildContent(textPrompt, image));
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
        return Response.json({ suggestions: Array.isArray(parsed) ? parsed : [] });
      } catch {
        return Response.json({ suggestions: [] });
      }

    } else {
      return Response.json({ error: "Action must be 'analyze', 'generate', 'split', 'surprise', 'suggest', or 'check'" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("API error:", message);
    // Friendly messages for common API issues
    const isServerDown = /502|503|504|Server exception/i.test(message);
    const friendlyMessage = isServerDown
      ? "The AI service is temporarily down. This usually resolves in a few minutes — please try again shortly."
      : `Failed to process request: ${message}`;
    return Response.json(
      { error: friendlyMessage },
      { status: 500 }
    );
  }
}
