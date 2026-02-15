"use client";

import {
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  Check,
  Copy,
  ImagePlus,
  X,
} from "lucide-react";
import { useState, useRef, useEffect, FormEvent, useCallback } from "react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64 data URLs
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

// Render inline markdown: **bold** and `inline code`
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Split on **bold** and `inline code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={i} className="font-semibold text-[var(--text-primary)]">
          {boldMatch[1]}
        </strong>
      );
    }
    const inlineMatch = part.match(/^`([^`]+)`$/);
    if (inlineMatch) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-[#1a1a1a] text-[#e6e6e6] text-[13px] font-mono border border-[var(--border-color)]"
        >
          {inlineMatch[1]}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// Render a block of non-code text with headings, lists, bold, inline code
function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!listBuffer) return;
    if (listBuffer.type === "ul") {
      elements.push(
        <ul
          key={`list-${elements.length}`}
          className="my-1.5 pl-5 space-y-1 list-disc text-[var(--text-primary)]"
        >
          {listBuffer.items}
        </ul>,
      );
    } else {
      elements.push(
        <ol
          key={`list-${elements.length}`}
          className="my-1.5 pl-5 space-y-1 list-decimal text-[var(--text-primary)]"
        >
          {listBuffer.items}
        </ol>,
      );
    }
    listBuffer = null;
  };

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];

    // Headings: ### > ## > #
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      flushList();
      elements.push(
        <h3
          key={j}
          className="text-lg font-bold text-[var(--text-primary)] mt-4 mb-1.5"
        >
          {renderInlineMarkdown(h3Match[1])}
        </h3>,
      );
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      flushList();
      elements.push(
        <h2
          key={j}
          className="text-xl font-bold text-[var(--text-primary)] mt-5 mb-2"
        >
          {renderInlineMarkdown(h2Match[1])}
        </h2>,
      );
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      flushList();
      elements.push(
        <h1
          key={j}
          className="text-2xl font-bold text-[var(--text-primary)] mt-5 mb-2"
        >
          {renderInlineMarkdown(h1Match[1])}
        </h1>,
      );
      continue;
    }

    // Unordered list item: - text or * text
    const ulMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (ulMatch) {
      if (!listBuffer || listBuffer.type !== "ul") {
        flushList();
        listBuffer = { type: "ul", items: [] };
      }
      listBuffer.items.push(
        <li key={j}>{renderInlineMarkdown(ulMatch[1])}</li>,
      );
      continue;
    }

    // Ordered list item: 1. text
    const olMatch = line.match(/^\s*\d+\.\s+(.+)/);
    if (olMatch) {
      if (!listBuffer || listBuffer.type !== "ol") {
        flushList();
        listBuffer = { type: "ol", items: [] };
      }
      listBuffer.items.push(
        <li key={j}>{renderInlineMarkdown(olMatch[1])}</li>,
      );
      continue;
    }

    // Regular line — flush any pending list
    flushList();

    // Empty line → spacing
    if (line.trim() === "") {
      elements.push(<br key={j} />);
      continue;
    }

    // Normal paragraph line
    elements.push(
      <span key={j}>
        {renderInlineMarkdown(line)}
        {j < lines.length - 1 ? "\n" : ""}
      </span>,
    );
  }
  flushList();

  return <>{elements}</>;
}

// Render message content with code blocks and markdown
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

        return <MarkdownBlock key={i} text={part} />;
      })}
    </>
  );
}

import type { ModelProvider } from "@/components/dashboard";

interface ChatInterfaceProps {
  disabled?: boolean;
  messages: Message[];
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  onResponseComplete?: () => void;
  modelName?: string;
  provider?: ModelProvider;
}

export function ChatInterface({
  disabled,
  messages,
  setMessages,
  onResponseComplete,
  modelName,
  provider = "local",
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);

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

  // Scroll focused input into view when mobile keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")
      ) {
        // Small delay to let the browser finish layout adjustments
        setTimeout(() => {
          activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    };

    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  // Convert file to base64 data URL
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (imageFiles.length === 0) return;

    const newImages: string[] = [];
    for (const file of imageFiles) {
      // Limit to 4 images total
      if (pendingImages.length + newImages.length >= 4) break;
      const base64 = await fileToBase64(file);
      newImages.push(base64);
    }
    setPendingImages((prev) => [...prev, ...newImages].slice(0, 4));
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle paste for images
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (provider !== "cloud") return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        handleImageUpload(imageFiles);
      }
    },
    [provider, pendingImages.length],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const hasContent = input.trim() || pendingImages.length > 0;
    if (!hasContent || isLoading || disabled) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput("");
    setPendingImages([]);
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
            images: m.images,
          })),
          provider,
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
      setError("Failed to send message.");
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
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6">
            {messages.map((m) => (
              <div key={m.id} className="message-animate">
                <div className="flex items-start gap-2.5 sm:gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {m.role === "assistant" ? (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent)] flex items-center justify-center overflow-hidden">
                        <img
                          src="/ai-avatar.png"
                          alt="AI"
                          className="w-5 h-5 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#565869] flex items-center justify-center overflow-hidden">
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
                            <div className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-[var(--text-primary)] whitespace-pre-wrap break-words">
                              <MessageContent text={parsed.response} />
                              {isLoading && isLastMsg && !parsed.isThinking && (
                                <span className="inline-block w-1.5 h-5 bg-[var(--text-secondary)] ml-0.5 align-middle animate-pulse rounded-sm" />
                              )}
                            </div>
                          </>
                        );
                      })()}
                    {m.role === "user" && (
                      <>
                        {m.images && m.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {m.images.map((img, idx) => (
                              <div
                                key={idx}
                                className="relative rounded-xl overflow-hidden border border-[var(--border-color)] max-w-[200px]"
                              >
                                <img
                                  src={img}
                                  alt={`Upload ${idx + 1}`}
                                  className="w-full h-auto max-h-[200px] object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {m.content && (
                          <div className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-[var(--text-primary)] whitespace-pre-wrap break-words">
                            <MessageContent text={m.content} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="message-animate">
                <div className="flex items-start gap-2.5 sm:gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent)] flex items-center justify-center overflow-hidden">
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
      <div className="flex-shrink-0 px-3 sm:px-4 pb-3 sm:pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit}>
            {/* Image preview strip */}
            {pendingImages.length > 0 && (
              <div className="flex gap-2 mb-2 px-2">
                {pendingImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-[var(--border-color)] bg-[#1a1a1a]"
                  >
                    <img
                      src={img}
                      alt={`Upload ${idx + 1}`}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingImage(idx)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white hover:bg-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className="input-glow relative flex items-end rounded-3xl border border-[var(--border-color)] transition-colors"
              style={{ background: "var(--input-bg)" }}
              onDragOver={(e) => {
                if (provider === "cloud") {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onDrop={(e) => {
                if (provider !== "cloud") return;
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files.length > 0) {
                  handleImageUpload(e.dataTransfer.files);
                }
              }}
            >
              {/* Image upload button - only for cloud provider */}
              {provider === "cloud" && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleImageUpload(e.target.files);
                        e.target.value = "";
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={
                      isLoading || disabled || pendingImages.length >= 4
                    }
                    className={`flex-shrink-0 p-2.5 sm:p-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ${
                      pendingImages.length >= 4
                        ? "opacity-30 cursor-not-allowed"
                        : ""
                    }`}
                    title="Upload image (max 4)"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>
                </>
              )}

              <textarea
                ref={textareaRef}
                className={`flex-1 resize-none bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm sm:text-[15px] py-3 sm:py-3.5 ${
                  provider === "cloud" ? "pl-0" : "pl-4 sm:pl-5"
                } pr-12 sm:pr-14 outline-none max-h-[200px] leading-6`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onFocus={(e) => {
                  setTimeout(() => {
                    e.target.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 300);
                }}
                placeholder={
                  disabled
                    ? "Start server to chat..."
                    : provider === "cloud"
                      ? `Message ${modelName || "My AI"} (paste or attach images)`
                      : `Message ${modelName || "My AI"}`
                }
                disabled={isLoading || disabled}
                rows={1}
              />
              <button
                type="submit"
                disabled={
                  isLoading ||
                  (!input.trim() && pendingImages.length === 0) ||
                  disabled
                }
                className={`absolute right-2.5 bottom-2.5 p-1.5 rounded-full transition-all ${
                  (input.trim() || pendingImages.length > 0) &&
                  !isLoading &&
                  !disabled
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
