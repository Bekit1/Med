export interface UiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ChatMessageProps {
  message: UiChatMessage;
}

function renderMarkdown(text: string): string {
  // HTML-escape first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers (### h3, ## h2, # h1) — must be before bold
  html = html.replace(/^### (.+)$/gm, '<h4 class="font-semibold mt-2 mb-1">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="font-semibold text-base mt-2 mb-1">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3 class="font-bold text-base mt-2 mb-1">$1</h3>');

  // Bold **text** and *italic*
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists: lines starting with - or *
  html = html.replace(/^[*-] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');

  // Numbered lists: lines starting with 1. 2. etc.
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  // Line breaks
  html = html.replace(/\n/g, "<br>");

  // Clean up: consecutive <br> between <li> items
  html = html.replace(/<\/li><br><li/g, "</li><li");

  return html;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm
          ${
            isUser
              ? "bg-emerald-500 text-white rounded-br-md"
              : "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-bl-md"
          }
        `}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div
            className="prose-sm [&_li]:my-0.5 [&_h3]:text-[var(--foreground)] [&_h4]:text-[var(--foreground)] [&_strong]:text-[var(--foreground)]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
        <p className={`mt-1 text-xs ${isUser ? "text-emerald-100" : "text-[var(--muted)]"}`}>
          {new Date(message.created_at).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
