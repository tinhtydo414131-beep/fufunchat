import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, MessageCircle, Heart } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Chào mừng bạn trở lại! ✨");
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
        toast.success("Chào mừng bạn đến với ánh sáng ✨ Hãy kiểm tra email để xác nhận nhé!");
      }
    } catch (error: any) {
      toast.error(error.message || "Có lỗi xảy ra — thử lại nhé 💛");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <MessageCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">FUN Chat</h1>
          <p className="text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4" />
            Free to Join. Free to Use. Earn Together.
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {isLogin ? "Chào mừng bạn trở lại ✨" : "Bắt đầu hành trình ánh sáng ✨"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Đăng nhập để tiếp tục kết nối"
                : "Tạo tài khoản và tham gia cộng đồng"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Tên hiển thị</Label>
                  <Input
                    id="displayName"
                    placeholder="Tên bạn muốn mọi người thấy 💛"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Đang xử lý..." : isLogin ? "Đăng nhập" : "Tạo tài khoản"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin
                  ? "Chưa có tài khoản? Tham gia ngay 💛"
                  : "Đã có tài khoản? Đăng nhập ✨"}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          Made with <Heart className="w-3 h-3 text-primary fill-primary" /> by FUN Ecosystem
        </p>
      </div>
    </div>
  );
};

export default Auth;
