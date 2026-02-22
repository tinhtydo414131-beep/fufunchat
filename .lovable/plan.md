

# Plan: Thêm 4 tính năng mới cho FUN Chat

## Tổng quan
Thêm 4 tính năng lớn vào ứng dụng chat: **Polls/Bình chọn**, **Location Sharing**, **Message Translation**, và **Chat Themes nâng cao**. Mỗi tính năng sẽ bao gồm cả backend (database tables, RLS policies) và frontend (UI components).

---

## 1. Polls / Bình chọn trong chat

Cho phép tạo khảo sát ngay trong cuộc trò chuyện, mọi người vote và xem kết quả real-time.

**Database:**
- Tạo bảng `polls` (id, conversation_id, creator_id, question, is_multiple_choice, created_at)
- Tạo bảng `poll_options` (id, poll_id, option_text, position)
- Tạo bảng `poll_votes` (id, poll_id, option_id, user_id, created_at) với unique constraint (poll_id, option_id, user_id)
- RLS: chỉ members trong conversation mới xem/vote được
- Enable realtime cho `poll_votes` để cập nhật live

**Frontend:**
- Component `CreatePollDialog` - form tạo poll với câu hỏi + tối đa 10 lựa chọn
- Component `PollMessage` - hiển thị poll inline trong chat với thanh progress, số vote, animation khi vote
- Gửi poll dưới dạng message type `poll` với content chứa poll_id
- Nút tạo poll trong thanh công cụ nhập liệu (icon BarChart)

---

## 2. Location Sharing

Chia sẻ vị trí hiện tại hoặc live location trong chat.

**Frontend (không cần database mới):**
- Sử dụng Browser Geolocation API để lấy vị trí
- Gửi dưới dạng message type `location` với content là JSON `{lat, lng, name?}`
- Component `LocationMessage` hiển thị bản đồ mini bằng OpenStreetMap embed (iframe) - miễn phí, không cần API key
- Nút "Open in Maps" mở Google Maps/Apple Maps
- Nút share location trong thanh công cụ (icon MapPin)

---

## 3. Message Translation

Tự động dịch tin nhắn sang ngôn ngữ của người dùng.

**Backend:**
- Tạo edge function `translate-message` sử dụng Lovable AI (Gemini Flash) để dịch text
- Input: text gốc + target language
- Output: bản dịch

**Frontend:**
- Thêm nút "Dịch" (icon Languages) trên mỗi tin nhắn từ người khác
- Khi nhấn, gọi edge function và hiển thị bản dịch bên dưới tin nhắn gốc với label ngôn ngữ (VD: "🇻🇳 Bản dịch")
- Cache bản dịch trong state để không phải dịch lại

---

## 4. Chat Themes / Backgrounds nâng cao

Mở rộng hệ thống theme hiện tại với nhiều tùy chọn hơn.

**Frontend (không cần database):**
- Thêm thêm gradient backgrounds và pattern wallpapers vào SettingsDialog
- Thêm tùy chọn đổi màu bubble chat (per-conversation color)
- Thêm một số theme preset: "Ocean", "Forest", "Sunset", "Galaxy", "Minimal"
- Lưu preferences vào localStorage (giống hệ thống hiện tại)

---

## Thứ tự triển khai

Do khối lượng lớn, đề xuất triển khai theo thứ tự ưu tiên:

1. **Message Translation** - nhanh nhất, chỉ cần 1 edge function + nút UI
2. **Polls / Bình chọn** - cần database + UI component mới
3. **Location Sharing** - cần UI component mới, dùng API miễn phí
4. **Chat Themes** - mở rộng hệ thống đã có

---

## Chi tiết kỹ thuật

### Database migrations (cho Polls)

```text
Tables:
  polls
    - id: uuid PK
    - conversation_id: uuid NOT NULL
    - creator_id: uuid NOT NULL
    - question: text NOT NULL
    - is_multiple_choice: boolean DEFAULT false
    - is_anonymous: boolean DEFAULT false
    - created_at: timestamptz DEFAULT now()

  poll_options
    - id: uuid PK
    - poll_id: uuid REFERENCES polls(id) ON DELETE CASCADE
    - option_text: text NOT NULL
    - position: integer DEFAULT 0

  poll_votes
    - id: uuid PK
    - poll_id: uuid REFERENCES polls(id) ON DELETE CASCADE
    - option_id: uuid REFERENCES poll_options(id) ON DELETE CASCADE
    - user_id: uuid NOT NULL
    - created_at: timestamptz DEFAULT now()
    - UNIQUE(poll_id, option_id, user_id)

RLS policies on all 3 tables:
  SELECT/INSERT/DELETE for conversation members only
```

### Edge function: translate-message

```text
POST /translate-message
Body: { text: string, targetLanguage: string }
Response: { translatedText: string }
Uses: Lovable AI (gemini-2.5-flash-lite) - no API key needed
```

### New UI components

```text
src/components/chat/CreatePollDialog.tsx   - Dialog tạo poll
src/components/chat/PollMessage.tsx        - Render poll trong chat
src/components/chat/LocationMessage.tsx    - Render location với map
src/components/chat/TranslateButton.tsx    - Nút dịch trên message
supabase/functions/translate-message/      - Edge function dịch
```

### Modified files

```text
src/components/chat/ChatArea.tsx     - Thêm location, poll buttons + render message types mới + translate button
src/components/chat/SettingsDialog.tsx - Thêm theme presets mới
```

