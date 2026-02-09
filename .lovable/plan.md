

# FUN CHAT 💬 — MVP Plan
*"Free to Join. Free to Use. Earn Together."*

## Vision
Xây dựng một ứng dụng chat web hiện đại, giao diện sáng sạch theo phong cách "Light Aura 5D", hoạt động thật với realtime messaging, sẵn sàng cho early adopters sử dụng hàng ngày.

---

## Phase 1: Nền tảng (Lovable Cloud + Auth)

### Đăng ký / Đăng nhập
- Đăng ký bằng email + mật khẩu
- Đăng nhập với Google (OAuth)
- Profile cơ bản: tên hiển thị, avatar, bio ngắn
- Ngôn ngữ UX tích cực: "Chào mừng bạn đến với ánh sáng ✨" thay vì "Create account"

### Trang chủ Chat
- Sidebar trái: danh sách conversations (giống Messenger)
- Khu vực chat chính ở giữa
- Responsive: hoạt động tốt trên mobile browser

---

## Phase 2: Core Chat Features

### Chat 1-1
- Tìm kiếm người dùng và bắt đầu chat
- Gửi tin nhắn text realtime (Supabase Realtime)
- Emoji picker tích hợp
- Typing indicator ("đang soạn tin...")
- Trạng thái đã xem (seen status)
- Reply tin nhắn cụ thể
- Reactions (❤️ 👍 😂 ✨ 🙏)

### Gửi media
- Gửi ảnh (upload qua Supabase Storage)
- Gửi file đính kèm
- Preview ảnh trong chat

### Quản lý tin nhắn
- Xóa / thu hồi tin nhắn (unsend)
- Tìm kiếm tin nhắn trong conversation

---

## Phase 3: Group Chat

### Tạo & quản lý nhóm
- Tạo group với nhiều thành viên
- Đặt tên nhóm + ảnh đại diện nhóm
- Thêm / xóa thành viên
- Rời nhóm

### Tính năng nhóm
- Chat realtime trong group
- Pin tin nhắn quan trọng
- Admin role cơ bản (admin có thể xóa tin, kick member)

---

## Phase 4: AI Angel Assistant 🤖

### Tích hợp AI trong chat
- Nút "Hỏi Angel AI" trong mỗi conversation
- Angel AI có thể: tóm tắt cuộc trò chuyện, dịch tin nhắn, gợi ý trả lời
- Tone AI: Kind, Warm, 5D Light — luôn tích cực và nâng đỡ
- Sử dụng Lovable AI gateway (Gemini) qua edge function

---

## Phase 5: Polish & Trải nghiệm

### Giao diện "Light Aura"
- Theme sáng mặc định, tông pastel ấm (vàng nhạt, hồng nhạt, xanh mint)
- Dark mode tùy chọn
- Animations mượt khi gửi/nhận tin
- Microcopy tích cực xuyên suốt:
  - Lỗi kết nối → "FUN Chat đang kết nối lại… ✨"
  - Không tìm thấy → "Chưa có kết quả — thử từ khóa khác nhé 💛"

### Online / Offline status
- Hiển thị trạng thái online của bạn bè
- "Hoạt động lần cuối" indicator

### Notifications
- Toast notifications khi có tin nhắn mới
- Unread count badge trên conversations

---

## Cấu trúc Database (Supabase)

- **profiles**: id, display_name, avatar_url, bio, created_at
- **conversations**: id, type (direct/group), name, avatar_url, created_at
- **conversation_members**: conversation_id, user_id, role, joined_at
- **messages**: id, conversation_id, sender_id, content, type (text/image/file), reply_to, created_at, updated_at, is_deleted
- **reactions**: message_id, user_id, emoji
- **Storage bucket**: chat-media (ảnh, file đính kèm)

---

## Không nằm trong MVP này
- Web3 / wallet / crypto payments (sẽ thêm sau)
- Channels broadcast (Phase 2 trong roadmap lớn)
- E2E encryption
- On-chain proof
- Earn mechanics
- Mini workspace / CRM

Các tính năng này được thiết kế sẵn trong kiến trúc để dễ dàng bổ sung sau.

---

## Kết quả mong đợi
Một ứng dụng chat web hoạt động thật, đẹp, mượt, sẵn sàng cho early adopters dùng hàng ngày — với nền tảng vững chắc để mở rộng thêm Web3, AI, và economy features trong tương lai.

