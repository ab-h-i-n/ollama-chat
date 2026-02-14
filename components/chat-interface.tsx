"use client";

import {
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  Check,
  Copy,
} from "lucide-react";
import { useState, useRef, useEffect, FormEvent, useCallback } from "react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// Parse <think>...</think> blocks from model output
function parseThinkContent(text: string): {
  thinking: string | null;
  response: string;
  isThinking: boolean;
} {
  const completeMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (completeMatch) {
    const thinking = completeMatch[1].trim();
    const response = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    return { thinking: thinking || null, response, isThinking: false };
  }

  const partialMatch = text.match(/<think>([\s\S]*)$/i);
  if (partialMatch) {
    const thinking = partialMatch[1].trim();
    return { thinking: thinking || null, response: "", isThinking: true };
  }

  return { thinking: null, response: text, isThinking: false };
}

// Collapsible thinking block component
function ThinkingBlock({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split("\n").filter((l) => l.trim());
  const previewLines = lines.slice(0, 2).join("\n");
  const hasMore = lines.length > 2;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors group"
      >
        <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span>{isStreaming ? "Thinking..." : "Thought process"}</span>
        {hasMore && !isStreaming && (
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      <div
        className={`mt-1.5 ml-5.5 border-l-2 border-[var(--border-color)] pl-3 text-[13px] leading-6 text-[var(--text-muted)] whitespace-pre-wrap overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[2000px]" : "max-h-[3.5rem]"
        }`}
      >
        {expanded || isStreaming ? content : previewLines}
        {isStreaming && (
          <span className="inline-block w-1 h-3.5 bg-[var(--text-muted)] ml-0.5 align-middle animate-pulse rounded-sm" />
        )}
      </div>

      {hasMore && !expanded && !isStreaming && (
        <button
          onClick={() => setExpanded(true)}
          className="ml-5.5 mt-1 text-[11px] text-[var(--accent)] hover:underline"
        >
          Show more
        </button>
      )}
    </div>
  );
}

// Code block with copy button
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[var(--border-color)]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[var(--border-color)]">
        <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <div className="bg-[#0d0d0d] overflow-x-auto">
        <pre className="p-4 text-[13px] leading-6 font-mono text-[#e6e6e6] m-0">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// Render message content with code blocks and inline code
function MessageContent({ text }: { text: string }) {
  if (!text) return null;

  // Split on triple-backtick code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        // Check if this part is a code block
        const codeMatch = part.match(/^```(\w*)?\n?([\s\S]*?)```$/);
        if (codeMatch) {
          const language = codeMatch[1] || "";
          const code = codeMatch[2].replace(/\n$/, "");
          return <CodeBlock key={i} code={code} language={language} />;
        }

        // Handle inline code and regular text
        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inlineParts.map((inline, j) => {
              const inlineMatch = inline.match(/^`([^`]+)`$/);
              if (inlineMatch) {
                return (
                  <code
                    key={j}
                    className="px-1.5 py-0.5 rounded-md bg-[#1a1a1a] text-[#e6e6e6] text-[13px] font-mono border border-[var(--border-color)]"
                  >
                    {inlineMatch[1]}
                  </code>
                );
              }
              return <span key={j}>{inline}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}

interface ChatInterfaceProps {
  disabled?: boolean;
  messages: Message[];
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  onResponseComplete?: () => void;
  modelName?: string;
}

export function ChatInterface({
  disabled,
  messages,
  setMessages,
  onResponseComplete,
  modelName,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMessageId = (Date.now() + 1).toString();

      setMessages((prev: Message[]) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev: Message[]) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: m.content + chunk }
              : m,
          ),
        );
      }

      // Notify parent that response is complete (for title generation, saving)
      onResponseComplete?.();
    } catch (err) {
      console.error(err);
      setError("Failed to send message. Ensure EC2 is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center px-4">
            {disabled ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[var(--input-bg)] flex items-center justify-center mx-auto mb-4 overflow-hidden">
                  <img
                    src="/ai-avatar.png"
                    alt="AI"
                    className="w-10 h-10 object-contain opacity-50"
                  />
                </div>
                <p className="text-[var(--text-muted)] text-sm">
                  Start the server to begin chatting
                </p>
              </div>
            ) : (
              <div className="text-center">
                <h1 className="text-3xl font-semibold text-[var(--text-primary)] mb-2">
                  What can I help with?
                </h1>
              </div>
            )}
          </div>
        )}

        {messages.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-6">
            {messages.map((m) => (
              <div key={m.id} className="message-animate">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {m.role === "assistant" ? (
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center overflow-hidden">
                        <img
                          src="/ai-avatar.png"
                          alt="AI"
                          className="w-5 h-5 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#565869] flex items-center justify-center overflow-hidden">
                        <img
                          src="/public-avatar.png"
                          alt="You"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      {m.role === "assistant" ? "My AI" : "You"}
                    </div>
                    {m.role === "assistant" &&
                      (() => {
                        const parsed = parseThinkContent(m.content);
                        const isLastMsg =
                          m.id === messages[messages.length - 1]?.id;
                        return (
                          <>
                            {parsed.thinking && (
                              <ThinkingBlock
                                content={parsed.thinking}
                                isStreaming={
                                  isLoading && isLastMsg && parsed.isThinking
                                }
                              />
                            )}
                            <div className="text-[15px] leading-7 text-[var(--text-primary)] whitespace-pre-wrap break-words">
                              <MessageContent text={parsed.response} />
                              {isLoading && isLastMsg && !parsed.isThinking && (
                                <span className="inline-block w-1.5 h-5 bg-[var(--text-secondary)] ml-0.5 align-middle animate-pulse rounded-sm" />
                              )}
                            </div>
                          </>
                        );
                      })()}
                    {m.role === "user" && (
                      <div className="text-[15px] leading-7 text-[var(--text-primary)] whitespace-pre-wrap break-words">
                        <MessageContent text={m.content} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="message-animate">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center overflow-hidden">
                      <img
                        src="/ai-avatar.png"
                        alt="AI"
                        className="w-5 h-5 object-contain"
                      />
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      My AI
                    </div>
                    <div className="flex items-center gap-1.5 py-2">
                      <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full typing-dot" />
                      <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full typing-dot" />
                      <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="message-animate flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                    <span className="text-red-400 text-xs font-bold">!</span>
                  </div>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div
              className="input-glow relative flex items-end rounded-3xl border border-[var(--border-color)] transition-colors"
              style={{ background: "var(--input-bg)" }}
            >
              <textarea
                ref={textareaRef}
                className="flex-1 resize-none bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-[15px] py-3.5 pl-5 pr-14 outline-none max-h-[200px] leading-6"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  disabled
                    ? "Start server to chat..."
                    : `Message ${modelName || "My AI"}`
                }
                disabled={isLoading || disabled}
                rows={1}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || disabled}
                className={`absolute right-2.5 bottom-2.5 p-1.5 rounded-full transition-all ${
                  input.trim() && !isLoading && !disabled
                    ? "bg-[var(--send-bg)] text-[var(--send-text)] hover:opacity-80"
                    : "bg-[#676767] text-[#3d3d3d] cursor-not-allowed"
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send
                    className="w-5 h-5"
                    style={{ transform: "rotate(-90deg)" }}
                  />
                )}
              </button>
            </div>
          </form>
          <p className="text-center text-[11px] text-[var(--text-muted)] mt-2.5">
            AI can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}
