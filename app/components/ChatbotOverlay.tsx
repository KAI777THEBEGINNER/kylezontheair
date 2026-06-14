"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSimpleChat } from "@/app/hooks/useSimpleChat";
import ChatMessage from "./ChatMessage";
import ChatInput, { type ChatInputRef } from "./ChatInput";
import type { Lang } from "@/app/data/content";
import { content } from "@/app/data/content";
import { drawQuestions, type QuestionItem } from "@/app/data/questions";
import FluidDotsShader from "./FluidDotsShader";

interface Props {
  progress: number;
  lang: Lang;
  onBackToTop: () => void;
  isLocked: boolean;
}

/** Text-style suggestion link with arrow icon prefix. Mobile: solid white; desktop: dimmed with hover. */
function SuggestionLink({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        text-left cursor-pointer
        text-white font-bold text-[13px] md:text-[14px] leading-snug
        md:hover:text-white/80 transition-colors duration-150
        inline-flex items-start gap-1
      "
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-[3px]">
        <path d="M4 4L12 12M4 4H11M4 4V11" />
      </svg>
      <span>{text}</span>
    </button>
  );
}

export default function ChatbotOverlay({ progress, lang, onBackToTop, isLocked }: Props) {
  const { messages, sendMessage, stop, status } = useSimpleChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const [initialQuestions, setInitialQuestions] = useState<QuestionItem[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<QuestionItem[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [inputHeight, setInputHeight] = useState(100);

  const isSubmitting = status === "submitted" || status === "streaming";
  // Only show chat UI when locked (scrolled to bottom), never in mid-opacity.
  // CSS transition handles the fade-in so text is never stuck at partial transparency.
  const opacity = isLocked ? 1 : 0;

  useEffect(() => {
    setInitialQuestions(drawQuestions(3));
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setFollowUpQuestions([]);
      return;
    }
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant" || status !== "idle") return;

    let cancelled = false;

    async function fetchFollowUps(retryCount = 0): Promise<void> {
      try {
        const res = await fetch("/api/follow-ups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            lang,
          }),
        });
        const data = (await res.json()) as { questions?: QuestionItem[] };
        const questions = data.questions?.slice(0, 3) ?? [];

        // 弹性追问：为空时最多再试 1 次；仍无合适追问则不显示，让对话自然结束
        if (questions.length === 0 && retryCount < 1) {
          return fetchFollowUps(retryCount + 1);
        }

        if (!cancelled) {
          setFollowUpQuestions(questions.length > 0 ? questions : drawQuestions(2));
        }
      } catch (err) {
        console.error("Failed to load follow-ups:", err);
        if (!cancelled) {
          setFollowUpQuestions(drawQuestions(2));
        }
      }
    }

    fetchFollowUps();

    return () => {
      cancelled = true;
    };
  }, [messages, status, lang]);

  // Measure input area height so message area can stop at it
  useEffect(() => {
    const measure = () => {
      if (inputRef.current) {
        setInputHeight(inputRef.current.offsetHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Auto-focus input when chat becomes visible (opens keyboard on mobile when allowed by OS)
  useEffect(() => {
    if (isLocked) {
      const timer = setTimeout(() => {
        chatInputRef.current?.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLocked]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, [messages, followUpQuestions]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const st = scrollRef.current.scrollTop;
    const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
    setScrolled(st < maxScroll - 10 && maxScroll > 0);
  }, []);

  const showInitialChips = initialQuestions.length > 0 && messages.length === 0 && !isSubmitting;
  const showFollowUpChips = followUpQuestions.length > 0 && messages.length > 0 && !isSubmitting && messages[messages.length - 1]?.role === "assistant";

  return (
    <>
      {/* Leave-chat text button */}
      <div
        className={`fixed top-[64px] md:top-[100px] left-1/2 -translate-x-1/2 z-[100] transition-opacity duration-300 pointer-events-none ${
          isLocked && scrolled ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          onClick={onBackToTop}
          className="text-white font-bold text-[13px] md:text-[14px] transition-colors cursor-pointer pointer-events-auto py-2 px-4"
        >
          {content[lang].ui.backToTop}
        </button>
      </div>

      {/* Top gradient blur — fades messages into navbar area */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-28 z-[45] transition-opacity duration-500 bg-black/50"
        style={{
          opacity,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
        }}
      />

      {/* Messages area — extends from top to just above input */}
      <div
        className="fixed left-0 right-0 z-40 transition-opacity duration-500 overflow-hidden pointer-events-none"
        style={{
          opacity,
          top: 0,
          bottom: inputHeight,
        }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={`h-full overflow-y-auto no-scrollbar px-4 pt-[180px] pb-6 md:px-6 relative ${opacity > 0.3 ? "pointer-events-auto" : "pointer-events-none"}`}
          style={{ overscrollBehavior: "contain" }}
        >
          {/* Message content */}
          <div className="relative z-10 mx-auto flex w-[92%] md:w-[80%] lg:w-[60%] xl:w-[50%] max-w-none flex-col gap-5">
            {messages.length === 0 && <div className="py-2" />}
            {messages.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
            ))}
            {/* Empty-state scroll handle: allows the user to swipe down to reveal the leave-chat button even before any messages exist. */}
            {messages.length === 0 && !isSubmitting && (
              <div className="h-[120vh] w-full shrink-0" aria-hidden="true" />
            )}
            {status === "submitted" && (
              <div className="py-1 text-[14px] text-shimmer">
                {lang === "zh" ? "正在思考..." : "Thinking..."}
              </div>
            )}

            {/* Follow-up suggestions — reserve vertical space so loaded questions fade in without pushing the answer up */}
            {messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && !isSubmitting && (
              <div className="flex flex-col gap-1.5 items-start min-h-[80px]">
                {showFollowUpChips && (
                  <div className="flex flex-col gap-1.5 items-start animate-fade-in">
                    {followUpQuestions.map((q) => (
                      <SuggestionLink
                        key={`fu-${q.id}`}
                        text={lang === "zh" ? q.zh : q.en}
                        onClick={() => sendMessage(lang === "zh" ? q.zh : q.en)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Initial suggestions (before first message) — above input */}
      {showInitialChips && (
        <div
          className="fixed left-0 right-0 z-[55] px-4 md:px-6 pb-2 transition-opacity duration-500 pointer-events-none"
          style={{
            opacity,
            bottom: inputHeight,
          }}
        >
          <div className={`mx-auto w-[92%] md:w-[80%] lg:w-[60%] xl:w-[50%] max-w-none ${opacity > 0.3 ? "pointer-events-auto" : "pointer-events-none"}`}>
            <div className="flex flex-col gap-1.5 items-start">
              {initialQuestions.map((q) => (
                <SuggestionLink
                  key={`init-${q.id}`}
                  text={lang === "zh" ? q.zh : q.en}
                  onClick={() => sendMessage(lang === "zh" ? q.zh : q.en)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input — fixed at the very bottom, highest z-index */}
      <div
        ref={inputRef}
        className="fixed bottom-0 left-0 right-0 z-[90] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-6 md:pb-6 transition-opacity duration-500 pointer-events-none"
        style={{
          opacity,
        }}
      >
        <div className={`relative mx-auto w-[92%] md:w-[80%] lg:w-[60%] xl:w-[50%] max-w-none ${opacity > 0.3 ? "pointer-events-auto" : "pointer-events-none"}`}>
          <ChatInput
            ref={chatInputRef}
            onSend={sendMessage}
            disabled={isSubmitting}
            status={status}
            onStop={stop}
            lang={lang}
          />
          <p className="mt-2 text-center text-white/40 whitespace-nowrap text-[clamp(9px,2.6vw,12px)]">
            {lang === "zh" ? "我的数字分身可能会出错，需要准确回复请直接联系我。" : "My digital avatar may make mistakes."}
          </p>
        </div>
      </div>
    </>
  );
}
