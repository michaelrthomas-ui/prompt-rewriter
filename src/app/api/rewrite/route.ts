import { NextRequest } from "next/server";

const GROK_EXPERTISE = `You are an expert on Grok's image-to-video AI model. You know that Grok works best with:
- Detailed scene composition (foreground, midground, background)
- Specific camera movements (pan, tilt, dolly, tracking shot, crane shot, steadicam)
- Lighting details (golden hour, overcast, neon, studio lighting, volumetric light)
- Motion descriptions (how subjects move, speed, direction)
- Visual style (cinematic, documentary, film noir, anime, etc.)
- Aspect ratio and mood
- Positive descriptions only (no negative prompts or "don't" instructions)
- Grok gets confused by contradictory instructions, impossible physics, and vague language
- For image-to-video: the prompt should describe how the image should ANIMATE — what movement, camera motion, and changes happen`;

const WAN_EXPERTISE = `You are an expert on Wan (Wan2.1) image-to-video AI model. You know that Wan works best with:
- Realistic human motion and facial expressions
- Clear, sequential action/motion descriptions
- Environment and atmosphere details (weather, time of day, setting)
- Pace and rhythm of movement
- Texture and material details for realism
- Emotional tone and mood
- Focused, clear descriptions (2-4 sentences ideal)
- Spatial relationships between subjects
- Positive descriptions only (no negative prompts)
- Wan gets confused by contradictory instructions, impossible physics, and overly long prompts
- For image-to-video: the prompt should describe how the image should ANIMATE — what movement, expressions, and changes happen`;

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
