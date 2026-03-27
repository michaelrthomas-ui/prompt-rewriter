import { NextRequest } from "next/server";

const GROK_EXPERTISE = `You are an expert on Grok Imagine's image-to-video AI model (by xAI). Here is your complete knowledge base:

PROMPT STRUCTURE:
- Use the formula: Subject + Motion, Background + Motion, Camera + Motion
- Think in this order: Scene (what's happening) → Camera (how it's filmed) → Style/lighting (how it looks) → Motion (how things move)
- Write in natural language like a scene description, NOT keyword stacking
- Optimal length: 600-700 characters with a clear focus. Too short = generic results. Too long = Grok loses focus.
- Focus on ONE core concept per prompt (e.g. "loneliness in a snowy village" or "joy in a sunlit meadow")

IMAGE-TO-VIDEO SPECIFIC:
- Since the image already establishes the scene, REDUCE or AVOID descriptions of static/unchanged parts
- Keep it simple and direct — focus on what MOVES and how the CAMERA behaves
- When the subject has prominent features, mention them to help position the subject (e.g. "an old man," "a woman wearing sunglasses")
- The model animates the image content based on your motion instructions

WHAT WORKS WELL:
- Cinematic framing terms: wide establishing shot, low-angle shot, close-up, over-the-shoulder, shallow depth of field
- Specific camera movements: slow pan right, dolly zoom in, aerial tracking shot, handheld
- Emotional tone words: "nostalgic," "melancholic," "electric," "tense," "dreamlike" (NOT generic words like "happy," "cool," "nice")
- Atmosphere cues: "soft morning light," "autumn leaves," "rainy mood," time of day, weather, emotional energy
- Artistic language: "bokeh," "wide-angle shot," "watercolor texture," "dreamlike haze"
- Frame rate hints: 24fps for cinematic, 30fps for natural motion, 60fps for slow-motion
- Audio cues: explicitly state preferences like "no music," "ambient wind," "city ambience" (Grok often adds generic music by default)

WHAT CONFUSES GROK / WHAT TO AVOID:
- Multiple subjects doing different things — the model struggles to track independent motions
- Abstract or metaphorical prompts — literal descriptions work far better
- Negation — "no clouds" may still produce clouds. Describe what IS there, not what isn't
- Fine temporal control — "at 2 seconds, the ball bounces" does NOT work
- Rapid scene changes — the model produces one continuous shot, not cuts
- Text rendering in video — virtually guaranteed to be garbled
- Complex compound prompts like "cyberpunk city with raining streets and neon signs" cause style shifts and glitches
- Overly long prompts with unclear language — results in hazy subjects, odd proportions, misplaced objects
- Contradictory instructions ("zoom in and zoom out simultaneously")

TECHNICAL LIMITS:
- Output is typically 4-6 seconds (up to 10 seconds for premium users)
- Faces and hands can warp or distort, especially with movement
- The source image anchors the first frame but the model may drift from details as video progresses
- One continuous shot per generation — no cuts or transitions`;

const WAN_EXPERTISE = `You are an expert on Wan 2.1 image-to-video AI model (by Alibaba). Here is your complete knowledge base:

PROMPT STRUCTURE:
- Text-to-video formula: Subject (description) + Scene (description) + Motion (description) + Aesthetic Control + Stylization
- Image-to-video formula: Motion Description + Camera Movement ONLY (the image provides subject, scene, and style)
- Optimal length: 80-120 words. Under-specifying causes random "cinematic" defaults. Overly long prompts get partially ignored.
- Use concrete, specific verbs for motion: "hair gently sways in the breeze" NOT "hair moves"

IMAGE-TO-VIDEO SPECIFIC:
- Since the image establishes appearance, do NOT re-describe the subject — this can cause CONFLICTS between prompt and reference image
- Focus almost entirely on: how things MOVE and how the CAMERA behaves
- Keep it shorter than text-to-video prompts since you skip subject/scene description
- Pro tip: If text-to-video can't nail a complex subject, generate a still image first, then use I2V

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

NEGATIVE PROMPTS (Wan supports these — they are CRITICAL for quality):
- Recommended universal negative prompt: "morphing, warping, distortion, blurry, low quality, face deformation, flickering, jittering, sudden changes, inconsistent lighting, no text, no watermark, no logos, no subtitles"
- For faces: add "consistent face, stable facial features" in positive, "identity drift, face morphing, shifting features" in negative
- For backgrounds: add "static background, stable scene" in positive, "background drift" in negative
- For smooth motion: add "smooth motion, stable" in positive, "jitter, shake, stutter" in negative

WHAT CONFUSES WAN / WHAT TO AVOID:
- OVERLOADING MOTION: asking for many simultaneous motions (hair sways + dress billows + bokeh shimmers + hands gesture) produces chaotic artifacts ~70% of the time. Limit to ONE primary motion + ONE optional secondary.
- Dolly-out reliably FAILS (dolly-in works fine)
- Panning generates motion but does NOT respect left/right direction — direction is basically random
- Whip pans (fast camera motion) do NOT work — the model refuses rapid camera movement
- Camera roll is nearly impossible to achieve
- Conflicting styles: "cinematic + cartoon + watercolor" confuses the model
- Vague prompts: the model fills gaps with random guesses that compound across frames
- Complex multi-step sequences in one prompt — keep it one continuous visual idea
- Setting guidance scale too high causes flickering (optimal: 5-6, max 7)

COMMON ARTIFACTS AND FIXES:
- Face morphing: Be very specific about identifying characteristics. Add face-stability terms.
- Flickering: Lower guidance scale, simplify motion
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
      stream: false,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.msg || "API request failed");
  }

  const data = await res.json();

  if (data.code && data.code !== 200) {
    throw new Error(data.msg || "API request failed");
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
        qaContext += `- "${q.question}" → ${q.answer === "yes" ? "Yes" : "No"}\n`;
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

Based on your expertise with ${modelName}, generate exactly 5 yes/no clarifying questions that will help you understand what they REALLY want. Focus on:
- Ambiguities in their description that could lead to unexpected results
- Important details they haven't specified that ${modelName} needs (camera, lighting, style, mood, motion)
- Potential misunderstandings or things ${modelName} might interpret differently than intended
- Creative choices that would significantly change the output
${image ? "- WHETHER THE PROMPT ACTUALLY MAKES SENSE FOR IMAGE-TO-VIDEO (if it contains dialogue, marketing text, or doesn't describe animation, your first question should address this and help the user understand what image-to-video prompts actually do)" : ""}

${questions && questions.length > 0 ? "IMPORTANT: Do NOT repeat any questions already asked above. Ask NEW questions that dig deeper based on what we now know from their previous answers." : ""}

Return ONLY a JSON array of 5 question strings. No explanations, no markdown, no code blocks. Just the raw JSON array.
Example: ["Would you like the camera to be moving during the shot?","Should the lighting be warm/golden rather than cool/blue?","Is this meant to be photorealistic rather than stylized?","Should there be motion blur to emphasize speed?","Do you want the subject centered in the frame?"]`;

      const text = await callKieAI(buildContent(textPrompt, image));

      let parsed;
      try {
        const match = text.match(/\[[\s\S]*\]/);
        parsed = match ? JSON.parse(match[0]) : JSON.parse(text);
      } catch {
        parsed = text
          .split("\n")
          .map((l: string) => l.replace(/^\d+\.\s*/, "").replace(/^["']|["']$/g, "").trim())
          .filter((l: string) => l.length > 10)
          .slice(0, 5);
      }

      return Response.json({ questions: parsed });

    } else if (action === "generate") {
      const textPrompt = `${expertise}

A user wants to create an image-to-video prompt for ${modelName}. Their initial idea is:

"${prompt}"${imageContext}${qaContext}

Now write the BEST possible ${modelName} image-to-video prompt based on everything you know about what they want. Apply all your expertise about what works well with ${modelName}. Make it detailed, specific, and optimized for the best possible output. Fix any issues that would confuse ${modelName}.

${image ? `CRITICAL: The prompt MUST describe how the uploaded image should ANIMATE into video. Describe motion, camera movement, and changes — NOT dialogue or text overlays. If the user's original prompt contained text they wanted spoken, translate that intent into visual actions (e.g. a person's lips moving naturally, confident body language, hand gestures) that ${modelName} can actually render.` : ""}

Return ONLY the final prompt, nothing else. No explanations, no labels, no quotes around it.`;

      const rewritten = await callKieAI(buildContent(textPrompt, image));
      return Response.json({ rewritten });

    } else {
      return Response.json({ error: "Action must be 'analyze' or 'generate'" }, { status: 400 });
    }
  } catch (err) {
    console.error("API error:", err);
    return Response.json(
      { error: "Failed to process request. Please try again." },
      { status: 500 }
    );
  }
}
