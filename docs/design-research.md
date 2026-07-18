# Cơ sở nghiên cứu cho quyết định sản phẩm

Ngày đối chiếu: 18/07/2026. Tài liệu này giải thích vì sao prototype chọn các guardrail và luồng hiện tại; không tuyên bố rằng các nguồn bên dưới chứng minh sản phẩm đã có tác động giáo dục.

## 1. AI hỗ trợ giáo viên, không tự xuất bản

[UNESCO — Guidance for generative AI in education and research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research?hub=66580) khuyến nghị cách tiếp cận human-centred, age-appropriate, bảo vệ dữ liệu và xác minh tính phù hợp sư phạm/đạo đức. Vì vậy AI chỉ tạo `DRAFT`; nguồn phải được xác minh, validator chạy trước và giáo viên vẫn là người sửa/duyệt/xuất bản.

[UNICEF — Guidance on AI and children 3.0](https://www.unicef.org/innocenti/reports/policy-guidance-ai-children) nhấn mạnh an toàn, riêng tư, công bằng, minh bạch, giải thích và trách nhiệm đối với hệ thống AI cho trẻ em. Điều này dẫn đến các quyết định: không dùng model để chấm kỷ luật/xếp loại, hiển thị rõ fallback, lưu evidence/model/rule version, dùng nickname ở leaderboard và yêu cầu consent/retention gate trước pilot thật.

## 2. Recommendation phải dẫn tới điều chỉnh học ngay

[IES/REL — review về formative assessment ở học sinh tiểu học](https://ies.ed.gov/use-work/resource-library/report/descriptive-study/formative-assessment-and-elementary-school-student-academic-achievement-review-evidence) định nghĩa formative assessment là thu thập, diễn giải và dùng evidence để điều chỉnh việc dạy/học trong thời gian ngắn. Review chọn 23 nghiên cứu đủ độ tin cậy và báo cáo tác động trung bình tích cực; kết quả cũng cho thấy cách có giáo viên hoặc chương trình máy tính điều phối thường có tác động lớn hơn trong tập nghiên cứu đó. Vì vậy mỗi bài có checkpoint và response không chỉ trả “đúng/sai”, mà trả một activity/phase cụ thể để học tiếp hoặc sửa lỗ hổng.

[EEF — Teacher Feedback to Improve Pupil Learning](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/feedback/) lưu ý feedback phải dựa trên mục tiêu học và gap được formative assessment phát hiện; feedback kém có thể không giúp hoặc gây hại. Vì vậy UI tránh gắn nhãn con người như “học sinh yếu”, ưu tiên feedback về task/process và không kết luận misconception từ một lỗi đơn lẻ.

## 3. Knowledge tracing là state estimate, không phải sự thật tuyệt đối

Nghiên cứu gốc của Corbett & Anderson, [Knowledge tracing: Modeling the acquisition of procedural knowledge](https://doi.org/10.1007/BF01099821), mô tả việc duy trì xác suất học sinh đã nắm từng rule và dùng estimate đó để cá nhân hóa chuỗi bài tập. Prototype dùng BKT vì phù hợp dữ liệu nhỏ và giải thích được, nhưng tách mastery khỏi retrievability, giữ observation confidence và cho rule trả `UNKNOWN/NEED_MORE_EVIDENCE`.

Đây không phải giấy phép để xem mastery là điểm số chính xác. Model card hiện có ROC-AUC synthetic khoảng 0.5691; pilot phải calibration, teacher override và so với baseline đơn giản trước khi mở rộng.

## 4. Dashboard dữ liệu không tự tạo ra tác động

[IES/NCEE — Evaluation of Support for Using Student Data to Inform Teachers' Instruction](https://ies.ed.gov/use-work/resource-library/report/evaluation-report/evaluation-support-using-student-data-inform-teachers-instruction) không tìm thấy cải thiện thành tích ở cách hỗ trợ data-driven instruction cụ thể được đánh giá, có thể vì nó không thay đổi thực hành dùng dữ liệu của giáo viên. Do đó sản phẩm không coi heatmap/dashboard là kết quả. Pilot phải đo recommendation acceptance/override, thay đổi hoạt động thực tế, completion/return, delayed recall và qualitative feedback.

## 5. Thiết kế cho bối cảnh thiết bị/kết nối không đồng đều

[UNICEF — EdTech for Good Framework 2.0](https://www.unicef.org/digitaleducation/stories/edtech-good-framework-20-strengthens-digital-and-ai-enabled-tools-learning-and-teaching) đặt trẻ em và evidence ở trung tâm, đồng thời yêu cầu xem xét tính minh bạch, an toàn, phù hợp bối cảnh và accessibility. [UNICEF — Child Centric AI](https://www.unicef.org/digitalimpact/stories/child-centric-ai) cũng nhấn mạnh data minimization, minh bạch phù hợp độ tuổi và hoạt động được trong điều kiện băng thông thấp/offline.

Vì vậy dataset pilot có thiết bị dùng chung, kết nối chập chờn, offline batch và event gửi muộn; recommendation dùng `available_minutes`; visual dùng asset local; paid LLM có local fallback. Đây mới là robustness ở mức prototype, chưa thay thế test thiết bị thật với học sinh Việt Nam.

## Hệ quả cho pilot

- Giữ 1 khóa/1 lớp/20 học sinh trong 4–6 tuần để quan sát implementation fidelity trước khi mở rộng.
- Chạy baseline lesson hoàn chỉnh cùng rubric, không so bài bổ trợ 7 phút với quy trình 40–50 giờ.
- Tách outcome giáo dục, độ hữu ích, độ chính xác nội dung, thời gian soạn và độ ổn định vận hành.
- Thu thập tối thiểu, định nghĩa retention/deletion, consent/assent và thực hiện legal/privacy review tại Việt Nam trước dữ liệu thật.
- Công bố cả fallback/error/override/rejection rate; không chỉ trình bày những recommendation đẹp.
