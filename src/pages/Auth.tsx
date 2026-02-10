import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useI18n";

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
    <div className="flex min-h-screen items-center justify-center p-4 bg-primary/5">
      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-24 h-24 rounded-full bg-primary mx-auto flex items-center justify-center shadow-lg">
            <MessageCircle className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">FUN Chat</h1>
          <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>

        <Card className="border-border/50 shadow-md">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">
              {isLogin ? t("auth.welcomeBack") : t("auth.startJourney")}
            </CardTitle>
            <CardDescription className="text-sm">
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
                    className="rounded-lg"
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
                  className="rounded-lg"
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
                  className="rounded-lg"
                />
              </div>
              <Button
                type="submit"
                className="w-full rounded-lg font-semibold text-sm h-11"
                disabled={loading}
              >
                {loading ? t("auth.processing") : isLogin ? t("auth.login") : t("auth.signup")}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline font-medium"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;