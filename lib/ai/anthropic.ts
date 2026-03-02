import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error(
        "[AI] ANTHROPIC_API_KEY is NOT set in environment variables. " +
        "Add it to .env.local: ANTHROPIC_API_KEY=sk-ant-..."
      );
      throw new Error("ANTHROPIC_API_KEY не настроен. Добавьте ключ в .env.local");
    }

    console.log("[AI] Anthropic client initialized, key present:", apiKey.slice(0, 10) + "...");

    client = new Anthropic({ apiKey });
  }
  return client;
}
