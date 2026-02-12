import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, language } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang = language || "vi";
    const systemPrompt = `You are a smart reply suggestion engine for a chat app. Given the recent conversation, suggest 3 short, natural reply options the user might want to send. 

Rules:
- Each reply should be 1-15 words max
- Replies should be in ${lang === "vi" ? "Vietnamese" : lang === "en" ? "English" : lang} language
- Make replies diverse: one agreement/positive, one question/follow-up, one casual/fun
- Include relevant emojis where appropriate
- Return ONLY a JSON array of 3 strings, no explanation

Example output: ["Được luôn! 👍", "Khi nào vậy?", "Hay quá 🎉"]`;

    const recentMessages = messages.slice(-6).map((m: any) => ({
      role: m.isMe ? "user" : "assistant",
      content: m.content,
    }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...recentMessages,
          { role: "user", content: "Suggest 3 smart replies." },
        ],
        temperature: 0.8,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Parse JSON from response
    let suggestions: string[] = [];
    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        suggestions = JSON.parse(match[0]);
      }
    } catch {
      suggestions = ["👍", "OK!", "🙂"];
    }

    return new Response(JSON.stringify({ suggestions: suggestions.slice(0, 3) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Smart reply error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
