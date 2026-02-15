"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  toggleInstance,
  checkStatus,
  type InstanceStatus,
} from "@/app/actions";
import { InstanceControl } from "@/components/instance-control";
import { ChatInterface, type Message } from "@/components/chat-interface";
import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  Trash2,
  Menu,
  Loader2,
} from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [ollamaCountdown, setOllamaCountdown] = useState(0);
  const prevStateRef = useRef<string | null>(null);
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // EC2 status polling
  const fetchStatus = async () => {
    const s = await checkStatus();
    setStatus(s);
    return s;
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(async () => {
      const s = await fetchStatus();
      if (s.state === "running" || s.state === "stopped") {
        setPolling(false);
      } else {
        setPolling(true);
      }

      // Detect transition to running → start Ollama countdown
      if (
        s.state === "running" &&
        prevStateRef.current !== null &&
        prevStateRef.current !== "running"
      ) {
        setOllamaCountdown(30);
      }
      prevStateRef.current = s.state;
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Ollama countdown timer
  useEffect(() => {
    if (ollamaCountdown <= 0) return;
    const timer = setTimeout(() => {
      setOllamaCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [ollamaCountdown]);

  const handleToggle = async (password: string) => {
    if (!status) return { success: false, error: "No status" };
    setLoading(true);
    const action = status.state === "running" ? "stop" : "start";
    try {
      const result = await toggleInstance(action, password);
      if (result.success) {
        setPolling(true);
        await fetchStatus();
      }
      return result;
    } catch (error) {
      console.error("Error toggling instance:", error);
      return { success: false, error: "Failed to toggle instance" };
    } finally {
      setLoading(false);
    }
  };

  const isRunning = status?.state === "running";
  const chatDisabled = !isRunning || ollamaCountdown > 0;

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
        body: JSON.stringify({ message: firstUserMsg.content }),
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
  }, [activeChatId, chats]);

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
    <div className="flex h-screen w-screen overflow-hidden">
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
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-red-400 transition-all"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Server Controls at bottom */}
          <div className="border-t border-[var(--border-color)] pt-3 mt-2">
            <InstanceControl
              status={status}
              loading={loading}
              polling={polling}
              onToggle={handleToggle}
              onRefresh={fetchStatus}
            />
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
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              My AI
            </span>
            {status?.modelName && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {status.modelName}
              </span>
            )}
          </div>
          <div className="flex-1" />
        </div>

        {/* Ollama countdown banner */}
        {ollamaCountdown > 0 && (
          <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2 px-4 bg-[#2a2a2a] border-b border-[var(--border-color)]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
            <span className="text-sm text-[var(--text-secondary)]">
              Waiting for Ollama to start... ({ollamaCountdown}s)
            </span>
          </div>
        )}

        {/* Chat */}
        {activeChat && (
          <ChatInterface
            key={activeChat.id}
            disabled={chatDisabled}
            messages={activeChat.messages}
            setMessages={setActiveMessages}
            onResponseComplete={handleResponseComplete}
            modelName={status?.modelName}
          />
        )}
      </div>
    </div>
  );
}
