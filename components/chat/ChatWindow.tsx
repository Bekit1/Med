"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Button from "@/components/ui/Button";
import ChatMessage, { type UiChatMessage } from "./ChatMessage";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/lib/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const WELCOME_MESSAGE: UiChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Здравствуйте! Я ваш медицинский AI-ассистент. Я могу помочь разобраться в результатах анализов, ответить на вопросы о здоровье и дать общие рекомендации.\n\nЧем могу помочь?",
  created_at: new Date().toISOString(),
};

export default function ChatWindow() {
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const supabase = createClient();

  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [contextUserId, setContextUserId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load chat history on mount
  useEffect(() => {
    if (!user) return;

    async function loadHistory() {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (data && data.length > 0) {
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            created_at: m.created_at,
          })),
        );
      } else {
        setMessages([WELCOME_MESSAGE]);
      }
      setHistoryLoaded(true);
    }

    loadHistory();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load family members for admin
  useEffect(() => {
    if (!isAdmin) return;

    async function loadFamily() {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("full_name");

      if (data) setFamilyMembers(data as Profile[]);
    }

    loadFamily();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: UiChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput("");
    setLoading(true);

    // Add placeholder for streaming response
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: UiChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          context_user_id: contextUserId || undefined,
        }),
      });

      if (!res.ok) {
        let errorMsg = "Не удалось получить ответ";
        try {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const errJson = await res.json();
            errorMsg = errJson.error || errorMsg;
          } else {
            errorMsg = (await res.text()) || errorMsg;
          }
        } catch {
          // ignore parse errors
        }

        const displayMsg = res.status === 503
          ? "AI-ассистент временно недоступен. Работа с записями доступна."
          : res.status === 429
            ? "Слишком много запросов. Подождите минуту."
            : `Ошибка: ${errorMsg}`;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: displayMsg }
              : m,
          ),
        );
        toast(res.status === 503 ? "AI-ассистент недоступен" : "Ошибка отправки сообщения", "error");
        setLoading(false);
        return;
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Ошибка: нет данных" } : m,
          ),
        );
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Update the placeholder message with accumulated text
        const current = accumulated;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: current } : m,
          ),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Произошла ошибка при получении ответа. Попробуйте ещё раз." }
            : m,
        ),
      );
      toast("Ошибка при получении ответа", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!historyLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Admin family selector */}
      {isAdmin && familyMembers.length > 1 && (
        <div className="border-b border-[var(--border)] px-4 py-2">
          <label className="mr-2 text-xs text-[var(--muted)]">Контекст пациента:</label>
          <select
            value={contextUserId || ""}
            onChange={(e) => setContextUserId(e.target.value || null)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]"
          >
            <option value="">Мой профиль</option>
            {familyMembers
              .filter((m) => m.id !== user?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.id}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {loading && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-[var(--card)] border border-[var(--border)] px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[var(--border)] p-3 md:p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Задайте вопрос о здоровье..."
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={!input.trim() || loading}>
            <span className="hidden md:inline">Отправить</span>
            <svg className="h-5 w-5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
