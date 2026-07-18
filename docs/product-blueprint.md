# Product blueprint — EduRecall AI cho EduOne

## Quyết định sản phẩm

Sản phẩm tập trung vào hai vòng lặp AI mà brief chấm trực tiếp:

1. Học sinh tạo learning event → hệ thống cập nhật trạng thái kiến thức → trả về một hoạt động cụ thể kèm lý do và bằng chứng.
2. Giảng viên chọn syllabus/evidence + nguồn đã xác minh → AI tạo `DRAFT` → validator kiểm tra → giảng viên sửa và duyệt → mới được xuất bản.

Website chỉ là lớp giao tiếp cho hai vòng lặp này. Sidebar học sinh còn **Hôm nay, Khóa học, Ôn tập, Tiến bộ**; sidebar giảng viên còn **Tổng quan, Lớp học, Nội dung AI, Phân tích**. Game, badge, leaderboard, model status và các trang chuyên sâu vẫn có route phục vụ demo/quan sát nhưng không còn tranh vị trí với tác vụ cốt lõi.

## Actor và luồng tối thiểu

### Học sinh

`Placement test → Lộ trình ban đầu → Bài học 3 pha → Learning event → Recommendation cụ thể → Ôn/bổ trợ → Cập nhật lộ trình`

Mỗi bài gồm:

- **Lý thuyết:** bài giảng ngắn, video có phụ đề, tài liệu đọc và visual animation từ allowlist an toàn.
- **Thực hành:** code, predict output, code order, trắc nghiệm và sửa lỗi. Hình thức “game” được trình bày như một hoạt động học có mục tiêu, độ khó và event; không tách thành game arcade.
- **Kiểm tra cuối bài:** câu hỏi mới theo kỹ năng, pass rule rõ ràng và kết quả dùng để quyết định học tiếp, luyện thêm hay ôn prerequisite.

### Giảng viên

`Chọn bài/misconception → Chọn nguồn VERIFIED → AI draft 3 pha → Validation → Sửa → Duyệt → Xuất bản → Đo thời gian/reuse/override`

Giảng viên có thể tạo bài gốc từ syllabus mà không cần chờ học sinh sai. Chỉ bài bổ trợ cá nhân mới bắt buộc recommendation evidence. Upload TXT được tách nội dung thật và phải qua xác minh; PDF/DOCX/PPTX ở trạng thái chờ worker, không được đưa vào prompt sớm.

## Khóa học pilot

**Python căn bản: Từ câu lệnh đầu tiên đến trò chơi tương tác** dành cho lớp 6–9, học trong 6 tuần, khoảng 16 giờ.

| Module | Bài học | Kết quả chính |
| --- | ---: | --- |
| Khởi động cùng Python | 3 | print, biến, kiểu dữ liệu, input và phép tính |
| Chương trình biết lựa chọn | 3 | Boolean, if/elif/else và mini project trợ lý học tập |
| Lặp có kiểm soát | 3 | for, range, while và điều kiện dừng |
| Dữ liệu, hàm và dự án | 3 | list, function/return và trò chơi hỏi–đáp cuối khóa |

Seed database chứa 12 bài, 36 learning resources và 84 practice/checkpoint exercises. Đây là catalog vận hành; dataset 48 exercises/400 attempts riêng được dùng để tái tạo model prototype.

## Contract AI cá nhân hóa

Recommendation không dừng ở `MICRO_LESSON` hay `PRACTICE_SET`. Response còn có:

- `target.type`, `target.id`, `target.title`, `target.phase`, `estimated_minutes`, `difficulty`;
- mastery, forgetting risk, recent error rate, prerequisite gap và next-attempt probability;
- attempt ID, rule ID, model version, candidate signal log và danh sách lý do tiếng Việt;
- chế độ `AI_SERVICE` hoặc `DETERMINISTIC_FALLBACK` được hiển thị rõ.

Một lỗi đơn lẻ không đủ để gắn nhãn misconception. Rule đã đăng ký cần evidence từ đáp án và lịch sử; pattern không đủ mạnh trả `UNKNOWN` hoặc `NEED_MORE_EVIDENCE`.

## Dữ liệu “không quá đẹp, không quá xấu”

Hai lớp dữ liệu mẫu đều deterministic và tái tạo được:

- 20 hồ sơ có khối lớp, mục tiêu, quỹ thời gian, tốc độ, hint rate, thiết bị dùng chung và kết nối khác nhau;
- persona mạnh/yếu/không ổn định/nghỉ dài/ít dữ liệu/cải thiện sau ôn;
- event có `occurred_at` và `received_at`, event muộn, offline batch, bỏ qua, phản hồi quá nhanh/chậm;
- bất thường có `data_quality_flags`, không phá khóa chính hay làm nhiễu ngẫu nhiên không kiểm soát.

Mọi dữ liệu đều có nhãn synthetic; không phải dữ liệu học sinh EduOne thật.

## Definition of done cho demo

- Hai học sinh có lịch sử khác nhau nhận target/reasons khác nhau và có log per-student.
- Giảng viên tạo được một bài 65 phút và một bài bổ trợ 7 phút từ nguồn/evidence thật trong hệ thống.
- Student endpoint không đọc được `DRAFT`; giáo viên phải duyệt và xuất bản.
- Báo cáo thời gian tách generation latency, active edit/review time và reuse; không so micro-lesson với baseline 40–50 giờ.
- Demo vẫn chạy khi paid provider lỗi bằng local template/fallback có nhãn rõ.
