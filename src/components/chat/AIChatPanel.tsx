import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Bot, Sparkles, Trash2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

type Msg = { role: "user" | "assistant"; content: string };

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const resp = await fetch(AI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      if (resp.status === 429) {
        toast.error("⏳ Rate limited — try again in a moment");
      } else if (resp.status === 402) {
        toast.error("💳 AI credits exhausted");
      } else {
        toast.error(errData.error || "AI error");
      }
      throw new Error(errData.error || "Stream failed");
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantSoFar = "";

    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    let streamDone = false;
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) upsertAssistant(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) upsertAssistant(content);
        } catch { /* ignore */ }
      }
    }
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat(newMessages);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("AI chat error:", err);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  const clearChat = () => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100dvh-6rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in-0 duration-300">
      {/* Header */}
      <div className="px-4 py-3 bg-primary text-primary-foreground flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">FUN AI Assistant</p>
          <p className="text-[10px] text-primary-foreground/70">Powered by AI ✨</p>
        </div>
        <Button variant="ghost" size="icon" onClick={clearChat} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full h-7 w-7" title="Clear chat">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Hi! I'm FUN AI 🤖</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                Ask me anything — coding, writing, translation, math, or just chat!
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {["Translate to English", "Explain quantum computing", "Write a poem 📝"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:p-0 [&_pre]:bg-transparent [&_pre]:overflow-x-auto [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-muted-foreground">
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeStr = String(children).replace(/\n$/, "");
                            if (match) {
                              return (
                                <div className="relative group/code my-1">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(codeStr);
                                      const btn = document.activeElement as HTMLButtonElement;
                                      btn?.setAttribute("data-copied", "true");
                                      setTimeout(() => btn?.removeAttribute("data-copied"), 2000);
                                    }}
                                    className="absolute right-2 top-2 p-1 rounded bg-white/10 hover:bg-white/20 text-white/60 hover:text-white opacity-0 group-hover/code:opacity-100 transition-opacity z-10 [&[data-copied=true]_svg:first-child]:hidden [&[data-copied=true]_svg:last-child]:block"
                                    title="Copy code"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <Check className="w-3.5 h-3.5 hidden text-green-400" />
                                  </button>
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ borderRadius: "0.5rem", fontSize: "0.75rem", margin: 0 }}
                                  >
                                    {codeStr}
                                  </SyntaxHighlighter>
                                </div>
                              );
                            }
                            return <code className={className} {...props}>{children}</code>;
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                  {msg.role === "assistant" && isLoading && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-foreground/50 ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSend} className="p-2 border-t border-border flex items-center gap-2">
        <Input
          ref={inputRef}
          placeholder="Ask AI anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="bg-muted/50 border-0 text-sm"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="shrink-0 h-8 w-8 rounded-full">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
