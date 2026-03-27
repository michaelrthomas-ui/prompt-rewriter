import { NextRequest } from "next/server";

const GROK_EXPERTISE = `You are an expert on Grok Imagine's image-to-video AI model (by xAI, powered by the Aurora engine). Your knowledge is current as of March 2026.

MODEL VERSION: Grok Imagine 1.0 (February 2026), with Extend from Frame (March 2, 2026) and multi-image reference support (up to 7 images).

CRITICAL OUTPUT RULES — THE PROMPT YOU GENERATE MUST:
- Be 50-150 words (the sweet spot). Never exceed 200 words.
- Contain ONLY ONE primary action/motion. One subject + one main action + one camera move per prompt.
- Front-load the most important details in the FIRST 20-30 words — Grok prioritizes the beginning.
- Be written in natural language like a scene description, NOT keyword stacking.
- If the user's idea involves multiple steps/actions, generate SEPARATE prompts for each step (labeled "Clip 1:", "Clip 2:", etc.) that can be chained using Extend from Frame. Each clip prompt must stand alone.
- Focus on ONE core concept per prompt (e.g. "loneliness in a snowy village" or "joy in a sunlit meadow")

PROMPT STRUCTURE (5 layers — strong prompts touch at least 3):
1. Scene — what's happening (subject + single action)
2. Camera — how it's filmed (one camera move or "static/locked shot")
3. Style/lighting — how it looks (color, atmosphere, time of day)
4. Motion — how things move (speed, quality of movement)
5. Audio — what we hear (Grok generates native synchronized audio)

IMAGE-TO-VIDEO SPECIFIC:
- Since the image already establishes the scene, REDUCE or AVOID descriptions of static/unchanged parts
- Keep it simple and direct — focus on what MOVES and how the CAMERA behaves
- When the subject has prominent features, mention them to help position the subject (e.g. "an old man," "a woman wearing sunglasses")
- Community tip: darker/moodier base images tend to produce better I2V results
- Image-first workflow often produces better results than straight text-to-video

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
- Audio cues: Grok generates NATIVE synchronized AUDIO with every video. Always include audio direction: "upbeat synth track," "ambient rain sounds," "epic orchestral swell," "silence," "no music" (otherwise Grok adds generic background music by default)
- Use positive descriptions only — describe what IS there, not what isn't

WHAT CONFUSES GROK / WHAT TO AVOID:
- MULTIPLE ACTIONS IN ONE PROMPT — this is the #1 mistake. Break complex sequences into separate clips.
- Multiple subjects doing different things — the model struggles to track independent motions
- Abstract or metaphorical prompts — literal descriptions work far better
- Negation — "no clouds" may still produce clouds. Always use positive descriptions instead.
- Fine temporal control — "at 2 seconds, the ball bounces" does NOT work
- Rapid scene changes — the model produces one continuous shot, not cuts
- Text rendering in video — virtually guaranteed to be garbled
- Complex compound prompts like "cyberpunk city with raining streets and neon signs" cause style shifts and glitches
- Overly long prompts — results in hazy subjects, odd proportions, misplaced objects
- Contradictory instructions ("zoom in and zoom out simultaneously")
- Fast pans, too many moving objects, or overly complex physics — reduce complexity if motion looks unstable

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

const WAN_EXPERTISE = `You are an expert on the Wan image-to-video AI model family (by Alibaba). Your knowledge is current as of March 2026.

MODEL VERSIONS:
- Wan 2.1 (Feb 2025): Original open-source release, Apache 2.0 license
- Wan 2.2 (July 2025): MoE architecture (two 14B experts, 27B total), significantly better quality, open-source
- Wan 2.6 (Dec 2025): Multi-shot generation, reference-to-video, native audio sync, 1080p, 15-second output — but CLOSED/commercial only
- Wan 3.0 (expected mid-2026): 60B params, targeting 4K and 30-second generation

PROMPT STRUCTURE (4-part hierarchy for best results — improves success rate from ~40% to ~82%):
1. Subject identity (what is in the frame)
2. Motion description (what moves, what stays still)
3. Camera behavior (how you are "filming" it)
4. Style and atmosphere (lighting, mood, color)

- Text-to-video: Subject + Scene + Motion + Aesthetic Control + Stylization
- Image-to-video: Motion Description + Camera Movement ONLY (the image provides subject, scene, and style)
- Optimal length: 80-120 words. Under-specifying causes random "cinematic" defaults. Overly long prompts get partially ignored.
- Use concrete, specific verbs: "hair gently sways in the breeze" NOT "hair moves"
- Use cinematography terms: "Slow dolly in, center-framed, steady" beats "Camera moves closer" (models trained on professional film data)
- Use adverbs for pace control: "quickly," "slowly," "gently"

IMAGE-TO-VIDEO SPECIFIC:
- Describe MOTION, not appearance — the image already provides the visual
- Do NOT re-describe the subject — this causes CONFLICTS between prompt and reference image
- Focus almost entirely on: how things MOVE and how the CAMERA behaves
- Keep it shorter than text-to-video prompts
- Image quality = 70% of output success. Resolution sweet spot: 768px to 2K.
- Match input aspect ratio to output (e.g., 1080x1920 for 9:16). Mismatches cause warping.
- Include complete limbs or crop at natural breaks (waist, shoulders). Cropped limbs cause phantom anatomy.
- Keep motion slow and controlled. Fast/aggressive motion produces smearing.
- One or two camera moves MAX per generation. Combining dolly + pan + zoom = chaos.
- For static camera: explicitly say "static shot" or "fixed shot"
- Expect 40-50% keeper rate with good prompts

WHAT WORKS WELL:
- Precise cinematography terms: pan, tilt, dolly in, tracking shot, orbit, push-in, pull back
- Speed modifiers: "slowly," "quickly," "time-lapse," "slow motion"
- Lighting descriptors: sunny, moonlit, fluorescent, firelight, overcast, golden hour
- Shot size: close-up, medium shot, wide shot, extreme close-up, bird's eye
- Camera angle: over-the-shoulder, high angle, low angle, Dutch angle, aerial
- Color tone: warm, cool, saturated, desaturated
- Style keywords: cinematic, vintage film look, shallow depth of field, motion blur
- Separating foreground/background motion: "Subject remains still with subtle breathing, background trees swaying gently, camera static"
- Subtle motions: breathing, hair swaying, water flowing, clouds drifting

NEGATIVE PROMPTS (Wan supports these — they are CRITICAL for quality, especially Wan 2.2+ which respects them much better):
- Universal starter: "low quality, blurry, distorted faces, unnatural movement, text, watermarks, shaky camera"
- Anti-flicker: "flicker, temporal flicker, strobe, shimmer, jitter, luminance pumping, brightness pulsing"
- Anti-face-drift: "identity drift, face morphing, off-model, expression drift, shifting features"
- Anti-blur: "soft focus, motion smear, ghosting, gaussian blur, out of focus, smudged detail"
- Anti-artifact (hands/edges): "extra fingers, deformed hands, duplicate limbs, bad anatomy, warped edges, aliasing"
- Pair negatives with strong structured positive prompts — negatives are guardrails, not the driver

WHAT CONFUSES WAN / WHAT TO AVOID:
- OVERLOADING MOTION: multiple simultaneous motions produce chaotic artifacts ~70% of the time. Limit to ONE primary motion + ONE optional secondary.
- Dolly-out reliably FAILS (dolly-in works fine)
- Panning does NOT respect left/right direction — direction is basically random
- Whip pans (fast camera motion) do NOT work
- Camera roll is nearly impossible to achieve
- Conflicting styles: "cinematic + cartoon + watercolor" confuses the model
- Vague prompts: the model fills gaps with random guesses that compound across frames
- Complex multi-step sequences — keep it one continuous visual idea
- Hands in motion: ~40%+ artifact rate even with good prompts. Best when slightly out of focus, in natural poses, or partially occluded.
- Multiple people interacting: ~65% artifact rate
- Text/logos in scene: warp consistently

COMMON ARTIFACTS AND FIXES:
- Face morphing: Be very specific about identifying characteristics. Add face-stability terms.
- Flickering: Lower guidance scale (optimal 5-6, max 7), simplify motion
- Identity drift: Use negative terms for drift
- Jittering: Add "smooth motion" positive and "jitter" negative

TECHNICAL LIMITS:
- Output is approximately 5 seconds at 480p or 720p
- One scene per generation — no cuts or transitions
- Supports English (primary) and Chinese prompts
- Diffusion-based model trained on over 1 billion video clips`;

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
    const { model, action, prompt, questions, image } = await request.json();

    if (!prompt && !image) {
      return Response.json({ error: "Please provide a prompt or upload an image" }, { status: 400 });
    }
    if (model !== "grok" && model !== "wan") {
      return Response.json({ error: "Model must be 'grok' or 'wan'" }, { status: 400 });
    }

    const modelName = model === "grok" ? "Grok" : "Wan";
    const expertise = model === "grok" ? GROK_EXPERTISE : WAN_EXPERTISE;

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

LOOK AT THE IMAGE CAREFULLY. Describe to yourself what you see — who/what is in it, the setting, the mood, what's interesting about it. Then ask questions that help narrow down their creative vision.${qaContext}

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

Based on your expertise with ${modelName}, generate 3-5 clarifying questions that will help you understand what they REALLY want. The user can answer Yes, No, or type a custom response. Focus on:
- Ambiguities in their description that could lead to unexpected results
- Important details they haven't specified that ${modelName} needs (camera, lighting, style, mood, motion)
- Potential misunderstandings or things ${modelName} might interpret differently than intended
- Creative choices that would significantly change the output
${image ? "- WHETHER THE PROMPT ACTUALLY MAKES SENSE FOR IMAGE-TO-VIDEO (if it contains dialogue, marketing text, or doesn't describe animation, your first question should address this and help the user understand what image-to-video prompts actually do)" : ""}

${questions && questions.length > 0 ? "IMPORTANT: Do NOT repeat any questions already asked above. Ask NEW questions that dig deeper based on what we now know from their previous answers." : ""}`;
      }

      const textPrompt = `${analyzeIntro}

CRITICAL QUESTION FORMAT RULES:
1. Every question MUST be answerable with "Yes", "No", or a short typed answer.
2. NEVER use the word "or" to present two options in a question. BANNED patterns: "Should X, or should Y?", "Should X or Y?", "Do you want X or Y?", "Should it be X or should it Y?"
3. Instead, pick ONE option and ask about it: "Should the motion be fast/energetic?" — the user answers Yes, No, or types their own preference.
4. Keep questions concise and specific.
5. Before returning, re-read EVERY question and reject any that contain " or " presenting two choices. Rephrase those as single-option yes/no questions.

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
      // Only catch REAL choice patterns like ", or should", ", or would", "X or Y?" at end
      // Do NOT touch synonyms like "unexpected or surprising" or ranges like "2 or 3"
      parsed.questions = parsed.questions.map((q: string) => {
        // Pattern 1: "Should X, or should/would/do Y?" — two separate clauses joined by ", or"
        const commaOrClause = q.match(/^(.{20,}),\s+or\s+(?:should|would|do|does|will|can|could)\s+.+\?$/i);
        if (commaOrClause) {
          let firstPart = commaOrClause[1].trim();
          if (!firstPart.endsWith("?")) firstPart += "?";
          return firstPart;
        }

        // Pattern 2: "Do you want X or Y?" where X and Y are clearly alternatives
        // Detected by ", or " (comma before or = deliberate alternative)
        const commaOr = q.match(/^(.{20,}),\s+or\s+(.+?\?)\s*$/i);
        if (commaOr) {
          let firstPart = commaOr[1].trim();
          if (!firstPart.endsWith("?")) firstPart += "?";
          return firstPart;
        }

        return q;
      });

      // Safety: filter out any questions that are too short (< 20 chars) as they were likely truncated
      parsed.questions = parsed.questions.filter((q: string) => q.length >= 20);

      return Response.json({ questions: parsed.questions, readyToGenerate: parsed.readyToGenerate });

    } else if (action === "generate") {
      const hasPrompt = prompt && prompt.trim().length > 0;
      const promptIntro = hasPrompt
        ? `A user wants to create an image-to-video prompt for ${modelName}. Their initial idea is:\n\n"${prompt}"${imageContext}${qaContext}`
        : `A user wants to create an image-to-video prompt for ${modelName}. They uploaded a reference image (shown above) but did not write their own prompt. Based on the image and their answers to your questions, create the best possible prompt.${qaContext}`;

      const textPrompt = `${expertise}

${promptIntro}

Now write the BEST possible ${modelName} image-to-video prompt based on everything you know about what they want. Apply all your expertise about what works well with ${modelName}. Make it detailed, specific, and optimized for the best possible output. Fix any issues that would confuse ${modelName}.

THE #1 RULE — PRESERVE THE USER'S CORE IDEA:
The user's main concept/action MUST appear in the generated prompt. NEVER remove, water down, or replace the user's core idea with something safer or simpler. If they want "a fish swallows a man whole," the prompt MUST describe a fish swallowing a man whole. If they want something surreal, fantastical, or physically impossible, INCLUDE IT — your job is to express their idea in the best possible way for ${modelName}, NOT to decide their idea is too hard and replace it with something generic. Optimize HOW it's described, never WHAT is described.

FORMATTING RULES FOR THE OUTPUT PROMPT:
- Each prompt must be 50-150 words. Never exceed 200 words.
- Each prompt must contain only ONE primary action. One subject + one main action + one camera move.
- Front-load the key subject and action in the first 20-30 words.
- Include at least 3 of the 5 layers: scene, camera, style/lighting, motion, audio.
- Use specific action verbs and cinematic language.
- Use positive descriptions only (never "no X" or "without X").
- If the user's idea involves multiple steps, actions, or a sequence that would take more than ~10 seconds, you MUST split it into multiple clip prompts labeled "Clip 1:", "Clip 2:", "Clip 3:", etc. Each clip should describe one action that works in a single 10-second generation. Note that clips can be chained using Grok's "Extend from Frame" feature.
- If it's a simple single-action idea, return just one prompt with no label.

${image ? `CRITICAL: The prompt MUST describe how the uploaded image should ANIMATE into video. Describe motion, camera movement, and changes — NOT dialogue or text overlays. If the user's original prompt contained text they wanted spoken, translate that intent into visual actions (e.g. a person's lips moving naturally, confident body language, hand gestures) that ${modelName} can actually render.` : ""}

Return ONLY the final prompt(s), nothing else. No explanations, no commentary, no quotes around it.`;

      const rewritten = await callKieAI(buildContent(textPrompt, image));
      return Response.json({ rewritten });

    } else {
      return Response.json({ error: "Action must be 'analyze' or 'generate'" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("API error:", message);
    return Response.json(
      { error: `Failed to process request: ${message}` },
      { status: 500 }
    );
  }
}
