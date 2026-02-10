import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Heart } from "lucide-react";
import { useTranslation } from "@/hooks/useI18n";
import funLogo from "@/assets/fun-logo.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.loginSuccess"));
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success(t("auth.signupSuccess"));
      }
    } catch (error: any) {
      toast.error(error.message || t("auth.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 gradient-primary opacity-[0.07]" />
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-fun-orange/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-fun-blue/10 blur-3xl" />
      <div className="absolute top-1/3 left-1/4 w-48 h-48 rounded-full bg-fun-pink/15 blur-2xl animate-float" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo & branding */}
        <div className="text-center space-y-3">
          <div className="inline-block animate-bounce-in">
            <img
              src={funLogo}
              alt="FUN Ecosystem"
              className="w-28 h-28 sm:w-32 sm:h-32 mx-auto object-contain drop-shadow-lg"
            />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gradient-primary tracking-tight">
            FUN Chat
          </h1>
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-base">
            <Sparkles className="w-4 h-4 text-fun-orange" />
            {t("app.tagline")}
            <Sparkles className="w-4 h-4 text-fun-blue" />
          </p>
        </div>

        <Card className="border-border/40 fun-shadow-lg backdrop-blur-sm bg-card/90">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {isLogin ? t("auth.welcomeBack") : t("auth.startJourney")}
              {" "}
              <span className="inline-block animate-wiggle">🎉</span>
            </CardTitle>
            <CardDescription>
              {isLogin ? t("auth.loginSubtitle") : t("auth.signupSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t("auth.displayName")}</Label>
                  <Input
                    id="displayName"
                    placeholder={t("auth.displayNamePlaceholder")}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required={!isLogin}
                    className="rounded-xl"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="rounded-xl"
                />
              </div>
              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground rounded-xl font-bold text-base h-11 fun-shadow hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? t("auth.processing") : isLogin ? t("auth.login") : t("auth.signup")}
                {" "}🚀
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          {t("auth.madeWith")} <Heart className="w-3 h-3 text-fun-pink fill-current" /> {t("auth.by")}
        </p>
      </div>
    </div>
  );
};

export default Auth;
