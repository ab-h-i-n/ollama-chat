"use client";

import { useState, useEffect, useCallback } from "react";
import { checkStatus, type InstanceStatus } from "@/app/actions";
import { ChatInterface, type Message } from "@/components/chat-interface";
import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  Trash2,
  Menu,
  ChevronDown,
  Cloud,
  Server,
} from "lucide-react";

export type ModelProvider = "local" | "cloud";

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

const STORAGE_KEY = "ai-chat-history";

function loadChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChats(chats: Chat[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (e) {
    console.error("Failed to save chats:", e);
  }
}

export function Dashboard() {
  const [status, setStatus] = useState<InstanceStatus | null>(null);
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [provider, setProvider] = useState<ModelProvider>("cloud");
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);

  // Set initial sidebar state based on screen size after mount
  useEffect(() => {
    setSidebarOpen(window.innerWidth >= MOBILE_BREAKPOINT);
  }, []);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load chats from localStorage on mount
  useEffect(() => {
    const loaded = loadChats();
    setChats(loaded);
    if (loaded.length > 0) {
      setActiveChatId(loaded[0].id);
    } else {
      // Create a fresh chat
      const newChat: Chat = {
        id: Date.now().toString(),
        title: "New chat",
        messages: [],
        createdAt: Date.now(),
      };
      setChats([newChat]);
      setActiveChatId(newChat.id);
    }
    setInitialized(true);
  }, []);

  // Save to localStorage whenever chats change (skip initial)
  useEffect(() => {
    if (initialized) {
      saveChats(chats);
    }
  }, [chats, initialized]);

  // Fetch model info on mount
  useEffect(() => {
    checkStatus().then(setStatus);
  }, []);

  const currentModelName =
    provider === "cloud"
      ? status?.cloudModelName || "Kimi-K2.5"
      : status?.modelName || "Local Model";

  // Active chat
  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  // Update messages for active chat
  const setActiveMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== activeChatId) return chat;
          const newMessages =
            typeof updater === "function" ? updater(chat.messages) : updater;
          return { ...chat, messages: newMessages };
        }),
      );
    },
    [activeChatId],
  );

  // Generate title after first exchange
  const handleResponseComplete = useCallback(async () => {
    if (!activeChatId) return;

    const chat = chats.find((c) => c.id === activeChatId);
    if (!chat) return;

    // Only generate title on first exchange (title is still "New chat")
    if (chat.title !== "New chat") return;

    const firstUserMsg = chat.messages.find((m) => m.role === "user");
    if (!firstUserMsg) return;

    try {
      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: firstUserMsg.content, provider }),
      });
      const data = await res.json();
      if (data.title) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChatId ? { ...c, title: data.title } : c,
          ),
        );
      }
    } catch (e) {
      console.error("Failed to generate title:", e);
      // Fallback: use first ~30 chars of message
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                title:
                  firstUserMsg.content.slice(0, 30) +
                  (firstUserMsg.content.length > 30 ? "..." : ""),
              }
            : c,
        ),
      );
    }
  }, [activeChatId, chats, provider]);

  // New chat
  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  // Delete chat
  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId);
      if (activeChatId === chatId) {
        if (filtered.length > 0) {
          setActiveChatId(filtered[0].id);
        } else {
          // Create new empty chat
          const newChat: Chat = {
            id: Date.now().toString(),
            title: "New chat",
            messages: [],
            createdAt: Date.now(),
          };
          setActiveChatId(newChat.id);
          return [newChat];
        }
      }
      return filtered;
    });
  };

  // Group chats by time
  const groupChats = (chatList: Chat[]) => {
    const now = Date.now();
    const day = 86400000;
    const groups: { label: string; chats: Chat[] }[] = [];
    const today: Chat[] = [];
    const yesterday: Chat[] = [];
    const week: Chat[] = [];
    const older: Chat[] = [];

    for (const chat of chatList) {
      const age = now - chat.createdAt;
      if (age < day) today.push(chat);
      else if (age < day * 2) yesterday.push(chat);
      else if (age < day * 7) week.push(chat);
      else older.push(chat);
    }

    if (today.length) groups.push({ label: "Today", chats: today });
    if (yesterday.length) groups.push({ label: "Yesterday", chats: yesterday });
    if (week.length) groups.push({ label: "Previous 7 days", chats: week });
    if (older.length) groups.push({ label: "Older", chats: older });

    return groups;
  };

  if (!initialized) return null;

  return (
    <div className="flex h-dvh w-screen overflow-hidden">
      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          isMobile
            ? `fixed inset-y-0 left-0 z-50 w-[280px] transition-transform duration-300 ease-in-out ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : `${sidebarOpen ? "w-[260px]" : "w-0"} flex-shrink-0 transition-all duration-300 overflow-hidden`
        }`}
      >
        <div
          className={`flex flex-col h-full ${
            isMobile ? "w-[280px]" : "w-[260px]"
          } p-2`}
          style={{ background: "var(--sidebar-bg)" }}
        >
          {/* Top area */}
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#2a2a2a] transition-colors"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                handleNewChat();
                if (isMobile) setSidebarOpen(false);
              }}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#2a2a2a] transition-colors"
              title="New chat"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto mt-1 space-y-4">
            {groupChats(chats).map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {group.label}
                </div>
                {group.chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    className={`group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors cursor-pointer ${
                      chat.id === activeChatId
                        ? "bg-[#2a2a2a] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[#2a2a2a] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-50" />
                    <span className="flex-1 truncate text-[13px]">
                      {chat.title}
                    </span>
                    <button
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-red-400 transition-all"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ background: "var(--main-bg)" }}
      >
        {/* Top bar */}
        <div className="flex items-center h-12 px-3 flex-shrink-0">
          {(isMobile || !sidebarOpen) && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--input-bg)] transition-colors"
                title="Open sidebar"
              >
                {isMobile ? (
                  <Menu className="w-5 h-5" />
                ) : (
                  <PanelLeft className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={handleNewChat}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--input-bg)] transition-colors"
                title="New chat"
              >
                <MessageSquarePlus className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="flex-1" />
          {/* Model selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[var(--input-bg)] transition-colors"
            >
              {provider === "cloud" ? (
                <Cloud className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <Server className="w-3.5 h-3.5 text-[var(--accent)]" />
              )}
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                  My AI
                </span>
                <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                  {currentModelName}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${providerDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {providerDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProviderDropdownOpen(false)}
                />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-52 rounded-xl border border-[var(--border-color)] bg-[#2a2a2a] shadow-xl z-50 overflow-hidden">
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setProvider("cloud");
                        setProviderDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        provider === "cloud"
                          ? "bg-[var(--accent)]/10 text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[#333]"
                      }`}
                    >
                      <Cloud
                        className={`w-4 h-4 flex-shrink-0 ${provider === "cloud" ? "text-[var(--accent)]" : ""}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {status?.cloudModelName || "GPT-OSS-120B"}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          Cloud · NVIDIA
                        </div>
                      </div>
                      {provider === "cloud" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setProvider("local");
                        setProviderDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        provider === "local"
                          ? "bg-[var(--accent)]/10 text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[#333]"
                      }`}
                    >
                      <Server
                        className={`w-4 h-4 flex-shrink-0 ${provider === "local" ? "text-[var(--accent)]" : ""}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {status?.modelName || "Local Model"}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          Local · EC2 Ollama
                        </div>
                      </div>
                      {provider === "local" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex-1" />
        </div>

        {/* Chat */}
        {activeChat && (
          <ChatInterface
            key={activeChat.id}
            disabled={false}
            messages={activeChat.messages}
            setMessages={setActiveMessages}
            onResponseComplete={handleResponseComplete}
            modelName={currentModelName}
            provider={provider}
          />
        )}
      </div>
    </div>
  );
}
