"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useSimpleChat(): {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
  status: "idle" | "submitted" | "streaming" | "error";
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);

  // Buffer for the full response text while it streams from the server.
  const pendingContentRef = useRef("");
  // ID of the assistant message currently being generated.
  const assistantIdRef = useRef<string | null>(null);
  // Content revealed to the user via the typing animation.
  const [revealedContent, setRevealedContent] = useState("");

  // Reveal the full response with a smooth typing animation after it is fully received.
  useEffect(() => {
    if (status !== "streaming" || !pendingContentRef.current) return;

    const full = pendingContentRef.current;
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setRevealedContent(full.slice(0, index));
      if (index >= full.length) {
        clearInterval(interval);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantIdRef.current ? { ...m, content: full } : m
          )
        );
        setStatus("idle");
      }
    }, 12); // ~83 chars/sec

    return () => clearInterval(interval);
  }, [status]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const assistantId = (Date.now() + 1).toString();
    assistantIdRef.current = assistantId;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    pendingContentRef.current = "";
    setRevealedContent("");
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStatus("submitted");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }

      pendingContentRef.current = buffer;
      setStatus("streaming");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, something went wrong. Please try again." }
              : m
          )
        );
        setStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
  }, [messages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    // If content was already buffered, show it immediately and finish.
    if (pendingContentRef.current && assistantIdRef.current) {
      const full = pendingContentRef.current;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantIdRef.current ? { ...m, content: full } : m
        )
      );
    }
    setStatus("idle");
  }, []);

  // During the reveal animation, expose the progressively typed content as the
  // assistant message content so the UI stays in sync.
  const displayMessages = useMemo(() => {
    if (status !== "streaming" || !assistantIdRef.current) return messages;
    return messages.map((m) =>
      m.id === assistantIdRef.current ? { ...m, content: revealedContent } : m
    );
  }, [messages, revealedContent, status]);

  return { messages: displayMessages, sendMessage, stop, status };
}
