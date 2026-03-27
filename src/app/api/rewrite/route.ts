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

async function callKieAI(content: string | MessageContent[]) {
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
    throw new Error(errorMsg);
  }

  const data = await res.json();

  if (data.code && data.code !== 200) {
    throw new Error(data.msg || `API error code ${data.code}`);
  }

  return data.content?.[0]?.text || "";
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

    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Prompt is required" }, { status: 400 });
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
      const textPrompt = `${expertise}

A user wants to create an image-to-video prompt for ${modelName}. Their initial idea is:

"${prompt}"${imageContext}${qaContext}

Based on your expertise with ${modelName}, generate 3-5 clarifying questions that will help you understand what they REALLY want. The user can answer Yes, No, or type a custom response. Focus on:
- Ambiguities in their description that could lead to unexpected results
- Important details they haven't specified that ${modelName} needs (camera, lighting, style, mood, motion)
- Potential misunderstandings or things ${modelName} might interpret differently than intended
- Creative choices that would significantly change the output
${image ? "- WHETHER THE PROMPT ACTUALLY MAKES SENSE FOR IMAGE-TO-VIDEO (if it contains dialogue, marketing text, or doesn't describe animation, your first question should address this and help the user understand what image-to-video prompts actually do)" : ""}

${questions && questions.length > 0 ? "IMPORTANT: Do NOT repeat any questions already asked above. Ask NEW questions that dig deeper based on what we now know from their previous answers." : ""}

CRITICAL QUESTION FORMAT RULES:
1. Every question MUST be answerable with "Yes", "No", or a short typed answer.
2. NEVER use the word "or" to present two options in a question. BANNED patterns: "Should X, or should Y?", "Should X or Y?", "Do you want X or Y?", "Should it be X or should it Y?"
3. Instead, pick ONE option and ask about it: "Should the motion be fast/energetic?" — the user answers Yes, No, or types their own preference.
4. Keep questions concise and specific.
5. Before returning, re-read EVERY question and reject any that contain " or " presenting two choices. Rephrase those as single-option yes/no questions.

READINESS ASSESSMENT: Based on the original prompt and all answers so far, decide if you have ENOUGH information to write an excellent ${modelName} prompt. You need at minimum: a clear subject/scene, motion intent, and camera/style direction. If you have all of these, set "readyToGenerate" to true. If critical details are still missing, set it to false.

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

      // Post-process: fix any "A or B?" questions that slipped through
      parsed.questions = parsed.questions.map((q: string) => {
        // Split on ", or " or " or should " to find A-or-B patterns
        // Use greedy match (.+) so we capture as much as possible before the last "or" split
        const commaOrMatch = q.match(/^(.+),\s+or\s+(.+?\?)\s*$/i);
        if (commaOrMatch) {
          let firstPart = commaOrMatch[1].trim();
          if (!firstPart.endsWith("?")) firstPart += "?";
          return firstPart;
        }
        // "Should X or Y?" but NOT "Should X or Y be Z?" (only split when "or" introduces a separate clause)
        const orShouldMatch = q.match(/^(.+)\s+or\s+(?:should|do|does|will|would|can|could)\s+(.+?\?)\s*$/i);
        if (orShouldMatch) {
          let firstPart = orShouldMatch[1].trim();
          if (!firstPart.endsWith("?")) firstPart += "?";
          return firstPart;
        }
        return q;
      });

      return Response.json({ questions: parsed.questions, readyToGenerate: parsed.readyToGenerate });

    } else if (action === "generate") {
      const textPrompt = `${expertise}

A user wants to create an image-to-video prompt for ${modelName}. Their initial idea is:

"${prompt}"${imageContext}${qaContext}

Now write the BEST possible ${modelName} image-to-video prompt based on everything you know about what they want. Apply all your expertise about what works well with ${modelName}. Make it detailed, specific, and optimized for the best possible output. Fix any issues that would confuse ${modelName}.

STRICT RULES FOR THE OUTPUT PROMPT:
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
