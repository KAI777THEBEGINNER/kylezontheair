import MarkdownRenderer from "./MarkdownRenderer";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";

  // Don't render empty assistant messages (the "air bubble" during thinking)
  if (!isUser && !content.trim()) return null;

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      {isUser ? (
        <div
          className="
            max-w-[85%]
            rounded-3xl
            border border-white/30
            bg-white/10
            backdrop-blur-xl
            will-change-[backdrop-filter]
            px-4 py-2.5
            text-white text-[18px] leading-[1.65]
            font-normal
            shadow-[0_4px_30px_rgba(0,0,0,0.15)]
          "
          style={{
            textShadow: "0 0 0.5px #fff, 0 1px 2px #000",
            // Force compositing layer and explicit vendor prefix for stable backdrop blur
            transform: "translateZ(0)",
            WebkitBackdropFilter: "blur(24px)",
            backdropFilter: "blur(24px)",
          }}
        >
          {content}
        </div>
      ) : (
        <div
          className="
            max-w-[90%]
            text-white text-[18px] leading-[1.65]
            font-normal
          "
          style={{
            textShadow: "0 0 0.5px #fff, 0 1px 2px #000",
          }}
        >
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
