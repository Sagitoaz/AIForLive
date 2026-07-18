export const concepts = [
  { code: "PYTHON_VARIABLES", title: "Biến & dữ liệu", mastery: 78, icon: "concept-variable", status: "mastered" },
  { code: "PYTHON_OPERATORS", title: "Toán tử", mastery: 71, icon: "concept-operator", status: "mastered" },
  { code: "PYTHON_IF_ELSE", title: "Điều kiện", mastery: 63, icon: "concept-branch", status: "active" },
  { code: "PYTHON_FOR", title: "Vòng lặp for", mastery: 58, icon: "concept-loop", status: "active" },
  { code: "PYTHON_RANGE", title: "Hàm range()", mastery: 42, icon: "concept-range", status: "focus" },
  { code: "PYTHON_WHILE", title: "Vòng lặp while", mastery: 39, icon: "concept-while", status: "locked" },
  { code: "PYTHON_LISTS", title: "List & index", mastery: 54, icon: "concept-list", status: "locked" },
  { code: "PYTHON_FUNCTIONS", title: "Hàm cơ bản", mastery: 31, icon: "concept-function", status: "locked" }
] as const;

export const studentNav = [
  ["/student", "Tổng quan", "nav-home"],
  ["/student/roadmap", "Lộ trình", "nav-roadmap"],
  ["/student/reviews", "Bài ôn", "nav-review"],
  ["/student/games", "Game center", "nav-game"],
  ["/student/progress", "Tiến bộ", "nav-chart"],
  ["/student/leaderboard", "Bảng xếp hạng", "nav-trophy"],
  ["/student/achievements", "Thành tựu", "nav-badge"]
] as const;

export const teacherNav = [
  ["/teacher", "Tổng quan", "nav-home"],
  ["/teacher/classes", "Lớp học", "nav-class"],
  ["/teacher/heatmap", "Knowledge map", "nav-grid"],
  ["/teacher/misconceptions", "Misconception", "nav-alert"],
  ["/teacher/studio", "AI content studio", "nav-spark"],
  ["/teacher/reviews", "Hàng chờ duyệt", "nav-review"],
  ["/teacher/analytics", "Analytics", "nav-chart"],
  ["/teacher/models", "Model status", "nav-model"]
] as const;

export const games = [
  { slug: "code-order", title: "Code Order", description: "Kéo các dòng code về đúng trật tự", asset: "game-asset-01", xp: 35, color: "purple" },
  { slug: "predict-output", title: "Predict Output", description: "Đọc code, chọn output", asset: "game-asset-02", xp: 30, color: "blue" },
  { slug: "bug-hunter", title: "Bug Hunter", description: "Soi dấu vết và bắt bug", asset: "game-asset-03", xp: 40, color: "orange" },
  { slug: "range-runner", title: "Range Runner", description: "Chạy qua dãy và dừng trước stop", asset: "game-asset-04", xp: 45, color: "green" }
] as const;

export const learners = [
  "Minh", "Lan", "An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Khánh", "Linh",
  "Mai", "Nam", "Oanh", "Phúc", "Quân", "Sơn", "Trang", "Uyên", "Việt", "Yến"
].map((name, index) => ({
  id: index === 0 ? "student-minh" : `student-${index + 1}`,
  name,
  nickname: `${name} ${["🌱", "🚀", "✨", "🧩"][index % 4] ?? "🌱"}`,
  avatar: `/assets/avatars/avatar-${String(index + 1).padStart(2, "0")}.svg`,
  xp: 1190 - index * 37 + (index % 3) * 18,
  improvement: 28 - (index % 9),
  streak: 12 - (index % 8),
  weak: ["range()", "while", "if/else", "list"][index % 4] ?? "range()"
}));

export const genericStudentPages: Record<string, { eyebrow: string; title: string; description: string; illustration: string }> = {
  onboarding: { eyebrow: "Thiết lập 2 phút", title: "Mục tiêu của Minh", description: "Chọn sản phẩm muốn tạo và thời gian học để hệ thống cân đối lộ trình.", illustration: "personalized-path" },
  course: { eyebrow: "4 khu vực · 10 nhiệm vụ", title: "Python cơ bản cho học sinh", description: "Từ biến đến hàm qua nhiệm vụ ngắn, checkpoint và mini-game.", illustration: "skill-mastery" },
  lesson: { eyebrow: "Nhiệm vụ 5", title: "Khám phá hàm range()", description: "Theo dấu robot Mầm qua một dãy số và tìm vạch dừng.", illustration: "code-challenge" },
  profile: { eyebrow: "Hồ sơ học tập", title: "Minh 🌱", description: "Mục tiêu 4 tuần, 120 phút mỗi tuần và quyền riêng tư cho dữ liệu demo.", illustration: "progress" }
};

export const genericTeacherPages: Record<string, { eyebrow: string; title: string; description: string; illustration: string }> = {
  classes: { eyebrow: "1 lớp pilot", title: "Python Explorers", description: "20 học viên với mức đầu vào, tốc độ và rủi ro quên khác nhau.", illustration: "class-dashboard" },
  "course-builder": { eyebrow: "Course builder", title: "4 module · 10 lesson", description: "Sắp xếp concept và hoạt động mà không khóa core platform vào Python.", illustration: "knowledge-graph" },
  exercises: { eyebrow: "Exercise manager", title: "50 hoạt động đang dùng", description: "Trắc nghiệm, code order, predict output, bug hunter và game.", illustration: "code-challenge" },
  sources: { eyebrow: "Knowledge sources", title: "Nguồn học liệu đã xác thực", description: "TXT, PDF, DOCX và PPTX được kiểm tra MIME, kích thước và tách chunk.", illustration: "upload" },
  upload: { eyebrow: "Safe upload", title: "Thêm tài liệu tham khảo", description: "Không chạy macro, script hoặc nội dung nhúng; teacher luôn duyệt output.", illustration: "upload" },
  jobs: { eyebrow: "Generation jobs", title: "Theo dõi content pipeline", description: "Context → JSON → validation → DRAFT, kèm provider, thời gian và chi phí.", illustration: "ai-generation" },
  "review-history": { eyebrow: "Audit trail", title: "Lịch sử kiểm duyệt", description: "Mỗi chỉnh sửa, phê duyệt và xuất bản đều có version và diff.", illustration: "teacher-review" },
  "content-analytics": { eyebrow: "Content production", title: "Tạo một lần, tái sử dụng đúng chỗ", description: "Đo thời gian tạo, thời gian giáo viên sửa, chi phí và reuse count.", illustration: "ai-generation" },
  leaderboard: { eyebrow: "Class settings", title: "Bảng xếp hạng là tùy chọn", description: "Dùng nickname; hỗ trợ most improved, consistent learner và recall master.", illustration: "leaderboard" }
};
