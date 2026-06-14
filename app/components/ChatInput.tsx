"use client";

import { useRef, useState, useImperativeHandle, forwardRef } from "react";
import type { Lang } from "@/app/data/content";
import { content } from "@/app/data/content";
import CapsuleButton from "./CapsuleButton";
import FluidDotsShader from "./FluidDotsShader";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  status?: string;
  onStop?: () => void;
  lang: Lang;
}

export interface ChatInputRef {
  focus: () => void;
}

const ChatInput = forwardRef<ChatInputRef, Props>(function ChatInput({ onSend, disabled, status, onStop, lang }, ref) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "57px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !composingRef.current) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "57px";
    el.style.height = Math.max(57, Math.min(el.scrollHeight, 200)) + "px";
  };

  const isSubmitting = status === "submitted" || status === "streaming";
  const ph = content[lang].ui.chatPlaceholder;

  return (
    <div className="flex items-end gap-3">
      {/* Input with 30% Gaussian blur backdrop */}
      <div
        className="flex flex-1 rounded-[24px] bg-white/[0.10] ring-1 ring-white/10 backdrop-blur-[30px]"
        style={{
          WebkitBackdropFilter: "blur(30px)",
          backdropFilter: "blur(30px)",
          transform: "translateZ(0)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          placeholder={ph}
          rows={1}
          disabled={disabled}
          style={{ height: 57, minHeight: 57 }}
          className="max-h-[200px] w-full resize-none overflow-hidden bg-transparent !text-[20px] leading-relaxed text-white placeholder:text-white/40 outline-none px-5 py-3"
        />
      </div>

      {/* Send / Stop button */}
      <CapsuleButton
        onClick={isSubmitting ? onStop : handleSubmit}
        className="relative h-[57px] w-[57px] !rounded-full !px-0 shrink-0 overflow-hidden"
      >
        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            isSubmitting ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            isSubmitting ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <FluidDotsShader size={44} />
        </span>
      </CapsuleButton>
    </div>
  );
});

export default ChatInput;
