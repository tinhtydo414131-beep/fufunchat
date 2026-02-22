import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, X, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function CreatePollDialog({ open, onOpenChange, conversationId }: CreatePollDialogProps) {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!question.trim() || !user) return;
    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast.error("Cần ít nhất 2 lựa chọn");
      return;
    }

    setSending(true);
    try {
      // Create poll
      const { data: poll, error: pollError } = await supabase
        .from("polls" as any)
        .insert({
          conversation_id: conversationId,
          creator_id: user.id,
          question: question.trim(),
          is_multiple_choice: multipleChoice,
          is_anonymous: anonymous,
        })
        .select("id")
        .single();

      if (pollError || !poll) {
        toast.error("Không thể tạo bình chọn");
        return;
      }

      // Create options
      const pollId = (poll as any).id;
      const optionsData = validOptions.map((text, i) => ({
        poll_id: pollId,
        option_text: text.trim(),
        position: i,
      }));

      const { error: optError } = await supabase
        .from("poll_options" as any)
        .insert(optionsData);

      if (optError) {
        toast.error("Lỗi tạo lựa chọn");
        return;
      }

      // Send poll message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: pollId,
        type: "poll",
      } as any);

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      toast.success("📊 Đã tạo bình chọn!");
      setQuestion("");
      setOptions(["", ""]);
      setMultipleChoice(false);
      setAnonymous(false);
      onOpenChange(false);
    } catch (e) {
      toast.error("Lỗi khi tạo bình chọn");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tạo bình chọn
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Câu hỏi</Label>
            <Input
              placeholder="Nhập câu hỏi bình chọn..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Lựa chọn</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder={`Lựa chọn ${i + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                />
                {options.length > 2 && (
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => removeOption(i)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <Button variant="outline" size="sm" onClick={addOption} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Thêm lựa chọn
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Chọn nhiều đáp án</Label>
            <Switch checked={multipleChoice} onCheckedChange={setMultipleChoice} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Bình chọn ẩn danh</Label>
            <Switch checked={anonymous} onCheckedChange={setAnonymous} />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!question.trim() || options.filter((o) => o.trim()).length < 2 || sending}
          >
            {sending ? "Đang tạo..." : "Tạo bình chọn"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
