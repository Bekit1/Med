import { getAnthropicClient } from "./anthropic";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompts";
import type { Attachment } from "@/lib/types";

export interface AnalysisFinding {
  name: string;
  value: string | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  status: "normal" | "low" | "high";
  comment: string | null;
}

export interface AnalysisResult {
  summary: string;
  status: "normal" | "warning" | "attention";
  findings: AnalysisFinding[];
  recommendations: string[];
  follow_up: string | null;
  tags: string[];
}

interface AttachmentData {
  attachment: Attachment;
  base64: string;
  mediaType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
}

export async function analyzeRecord(
  textContent: string,
  attachmentData: AttachmentData[] = [],
): Promise<AnalysisResult> {
  const client = getAnthropicClient();

  // Build content blocks for Claude
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlocks: any[] = [];

  // Add document/image blocks first
  for (const att of attachmentData) {
    if (att.mediaType === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: att.base64,
        },
      });
    } else {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mediaType,
          data: att.base64,
        },
      });
    }
  }

  // Add text content last
  contentBlocks.push({
    type: "text",
    text: `Проанализируй следующий медицинский документ:\n\n${textContent}`,
  });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: contentBlocks,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  const responseText = textBlock ? textBlock.text : "";

  return parseAnalysisResponse(responseText);
}

export function parseAnalysisResponse(text: string): AnalysisResult {
  const fallback: AnalysisResult = {
    summary: text || "Не удалось проанализировать документ.",
    status: "normal",
    findings: [],
    recommendations: [],
    follow_up: null,
    tags: [],
  };

  if (!text) return fallback;

  // Strategy 1: direct JSON.parse
  try {
    const parsed = JSON.parse(text);
    if (parsed.summary) return normalizeResult(parsed);
  } catch {
    // continue to next strategy
  }

  // Strategy 2: extract from ```json ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed.summary) return normalizeResult(parsed);
    } catch {
      // continue
    }
  }

  // Strategy 3: find first { ... } block
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      const parsed = JSON.parse(text.slice(braceStart, braceEnd + 1));
      if (parsed.summary) return normalizeResult(parsed);
    } catch {
      // continue
    }
  }

  // Fallback: raw text as summary
  return fallback;
}

function normalizeResult(raw: Record<string, unknown>): AnalysisResult {
  return {
    summary: (raw.summary as string) || "",
    status: (["normal", "warning", "attention"].includes(raw.status as string)
      ? raw.status
      : "normal") as AnalysisResult["status"],
    findings: Array.isArray(raw.findings) ? raw.findings : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
    follow_up: (raw.follow_up as string) || null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

/** Determine media type from file name. Returns null for unsupported types. */
export function getMediaType(
  fileName: string,
): AttachmentData["mediaType"] | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return null;
  }
}
