import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, Smartphone, Share, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  if (isStandalone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Already Installed! 🎉</h1>
          <p className="text-muted-foreground">FUN Chat is running as an app.</p>
          <Button onClick={() => navigate("/")} className="w-full">
            Open Chat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6">
      <div className="text-center space-y-6 max-w-sm animate-fade-in">
        <img
          src="/pwa-icon-512.png"
          alt="FUN Chat"
          className="w-24 h-24 rounded-3xl mx-auto shadow-lg"
        />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            FUN Chat
          </h1>
          <p className="text-muted-foreground">
            Install FUN Chat on your phone for the best experience!
          </p>
        </div>

        {installed ? (
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg font-semibold">Installed! 🎉</p>
            <p className="text-sm text-muted-foreground">Open FUN Chat from your home screen.</p>
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="w-full gap-2 text-base">
            <Download className="w-5 h-5" /> Install FUN Chat
          </Button>
        ) : isIOS ? (
          <div className="bg-card rounded-2xl p-5 space-y-4 border text-start">
            <p className="font-semibold text-sm">How to install on iPhone:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">1</div>
                <p className="text-sm text-muted-foreground pt-1">
                  Tap the <Share className="w-4 h-4 inline text-primary" /> <strong>Share</strong> button in Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</div>
                <p className="text-sm text-muted-foreground pt-1">
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">3</div>
                <p className="text-sm text-muted-foreground pt-1">
                  Tap <strong>"Add"</strong> and open from your home screen!
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-5 space-y-4 border text-start">
            <p className="font-semibold text-sm">How to install on Android:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">1</div>
                <p className="text-sm text-muted-foreground pt-1">
                  Tap the <MoreVertical className="w-4 h-4 inline text-primary" /> <strong>menu</strong> in Chrome
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</div>
                <p className="text-sm text-muted-foreground pt-1">
                  Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-6 pt-4 text-muted-foreground">
          <div className="text-center">
            <Smartphone className="w-5 h-5 mx-auto mb-1" />
            <span className="text-[10px]">Works Offline</span>
          </div>
          <div className="text-center">
            <Download className="w-5 h-5 mx-auto mb-1" />
            <span className="text-[10px]">No App Store</span>
          </div>
          <div className="text-center">
            <Check className="w-5 h-5 mx-auto mb-1" />
            <span className="text-[10px]">Always Updated</span>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
          Skip, continue in browser →
        </Button>
      </div>
    </div>
  );
}
