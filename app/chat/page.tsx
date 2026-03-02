import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPage() {
  return (
    <ProtectedLayout>
      <div className="flex h-[100dvh] flex-col">
        <Header title="AI-ассистент" description="Задайте вопрос о здоровье" />
        <div className="flex-1 overflow-hidden">
          <ChatWindow />
        </div>
      </div>
    </ProtectedLayout>
  );
}
