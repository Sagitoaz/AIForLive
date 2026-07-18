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
  ["/student", "Hôm nay", "nav-home"],
  ["/student/course", "Khóa học", "nav-roadmap"],
  ["/student/reviews", "Ôn tập", "nav-review"],
  ["/student/progress", "Tiến bộ", "nav-chart"]
] as const;

export const teacherNav = [
  ["/teacher", "Tổng quan", "nav-home"],
  ["/teacher/classes", "Lớp học", "nav-class"],
  ["/teacher/studio", "Nội dung AI", "nav-spark"],
  ["/teacher/analytics", "Phân tích", "nav-chart"]
] as const;

type LessonStatus = "COMPLETED" | "CURRENT" | "AVAILABLE" | "LOCKED";

function courseLesson(
  id: string,
  title: string,
  conceptCode: string,
  durationMinutes: number,
  status: LessonStatus,
  outcome: string,
  practice: string,
  checkpoint: string
) {
  return {
    id,
    title,
    conceptCode,
    durationMinutes,
    status,
    outcome,
    phases: [
      { phase: "THEORY" as const, title: "Lý thuyết", durationMinutes: Math.round(durationMinutes * 0.36), summary: outcome, resources: ["Bài giảng ngắn", "AI animation hoặc video", "Tài liệu đọc"] },
      { phase: "PRACTICE" as const, title: "Thực hành", durationMinutes: Math.round(durationMinutes * 0.44), summary: practice, resources: ["Code tương tác", "Trắc nghiệm", "Sửa lỗi"] },
      { phase: "CHECKPOINT" as const, title: "Kiểm tra cuối bài", durationMinutes: Math.max(8, Math.round(durationMinutes * 0.2)), summary: checkpoint, resources: ["3 câu theo kỹ năng", "Phản hồi cá nhân"] }
    ]
  };
}

export const pythonCourse = {
  id: "course-python",
  title: "Python căn bản: Từ câu lệnh đầu tiên đến trò chơi tương tác",
  shortTitle: "Python căn bản",
  description: "Khóa học dành cho học sinh lớp 6–9 chưa từng lập trình hoặc mới làm quen. Học sinh đi từ cách máy tính thực hiện câu lệnh đến tự xây một trò chơi hỏi–đáp bằng Python; mỗi bài đều có lý thuyết, thực hành và kiểm tra cuối bài.",
  audience: "Lớp 6–9 · Người mới bắt đầu",
  duration: "6 tuần · khoảng 16 giờ",
  cadence: "3 buổi/tuần · 45–60 phút/buổi",
  outcomes: [
    "Đọc và giải thích được chương trình Python ngắn",
    "Dùng biến, điều kiện, vòng lặp, list và hàm đúng mục đích",
    "Tìm lỗi bằng cách dự đoán rồi kiểm tra từng bước",
    "Hoàn thiện trò chơi hỏi–đáp có điểm số và nhiều lượt chơi"
  ],
  progress: 46,
  modules: [
    {
      id: "module-1",
      title: "Khởi động cùng Python",
      description: "Làm quen môi trường, dữ liệu đầu vào và cách chương trình ghi nhớ thông tin.",
      progress: 100,
      lessons: [
        courseLesson("lesson-01", "Ra lệnh cho máy tính", "PYTHON_OUTPUT", 45, "COMPLETED", "Dùng print() và đọc lỗi cú pháp cơ bản.", "Sắp xếp câu lệnh để in một tấm thiệp chào.", "Viết chương trình in đúng ba dòng theo yêu cầu."),
        courseLesson("lesson-02", "Biến và kiểu dữ liệu", "PYTHON_VARIABLES", 55, "COMPLETED", "Giải thích biến, chuỗi, số nguyên và số thực.", "Theo dõi giá trị biến qua từng dòng code.", "Chọn kiểu dữ liệu và sửa hai lỗi gán biến."),
        courseLesson("lesson-03", "Nhập liệu và phép tính", "PYTHON_OPERATORS", 60, "COMPLETED", "Nhận input, chuyển kiểu và tính một biểu thức.", "Viết máy tính tiền tiêu vặt đơn giản.", "Hoàn thiện chương trình tính tổng và giải thích kết quả.")
      ]
    },
    {
      id: "module-2",
      title: "Chương trình biết lựa chọn",
      description: "Biến yêu cầu đời thường thành biểu thức đúng/sai và nhánh xử lý rõ ràng.",
      progress: 100,
      lessons: [
        courseLesson("lesson-04", "So sánh và giá trị đúng/sai", "PYTHON_BOOLEAN", 55, "COMPLETED", "Tạo biểu thức Boolean bằng toán tử so sánh.", "Dự đoán kết quả của sáu biểu thức có dữ liệu gần thực tế.", "Phân biệt = với == trong ba tình huống."),
        courseLesson("lesson-05", "Rẽ nhánh với if / elif / else", "PYTHON_IF_ELSE", 70, "COMPLETED", "Thiết kế nhánh không chồng chéo và đúng thứ tự.", "Sửa chương trình xếp mức huy hiệu theo điểm.", "Xây trợ lý phản hồi theo ba khoảng điểm."),
        courseLesson("lesson-06", "Checkpoint: Trợ lý kế hoạch học", "PYTHON_IF_ELSE", 60, "COMPLETED", "Kết hợp input, phép tính và điều kiện trong một sản phẩm nhỏ.", "Lập trình trợ lý chọn thời lượng ôn theo quỹ thời gian.", "Giải thích một ca kiểm thử biên và tự đánh giá code.")
      ]
    },
    {
      id: "module-3",
      title: "Lặp có kiểm soát",
      description: "Lặp lại công việc đúng số lần, hiểu điểm dừng và tránh vòng lặp vô hạn.",
      progress: 34,
      lessons: [
        courseLesson("lesson-07", "Vòng lặp for", "PYTHON_FOR", 55, "COMPLETED", "Mô tả từng lượt lặp và biến điều khiển.", "Theo vết robot thực hiện nhiệm vụ qua nhiều lượt.", "Dự đoán output và viết một vòng lặp 4 lượt."),
        courseLesson("lesson-08", "Khám phá range()", "PYTHON_RANGE", 65, "CURRENT", "Đọc đúng start, stop, step và nhớ stop không thuộc dãy.", "Chạy code, sắp xếp output và sửa lỗi lệch một đơn vị.", "Hoàn thành 3 câu mới; cần đạt 2/3 để đi tiếp."),
        courseLesson("lesson-09", "while và điều kiện dừng", "PYTHON_WHILE", 70, "LOCKED", "Dùng while khi chưa biết trước số lượt lặp.", "Săn lỗi biến không cập nhật và vòng lặp vô hạn.", "Viết vòng lặp có điều kiện dừng an toàn.")
      ]
    },
    {
      id: "module-4",
      title: "Dữ liệu, hàm và dự án cuối khóa",
      description: "Tổ chức nhiều giá trị, đóng gói thao tác và ghép thành sản phẩm hoàn chỉnh.",
      progress: 0,
      lessons: [
        courseLesson("lesson-10", "List và vị trí phần tử", "PYTHON_LISTS", 65, "LOCKED", "Tạo list, truy cập index và duyệt phần tử.", "Quản lý danh sách câu hỏi của trò chơi.", "Sửa lỗi index và thêm phần tử đúng vị trí."),
        courseLesson("lesson-11", "Hàm, tham số và return", "PYTHON_FUNCTIONS", 75, "LOCKED", "Tách chương trình thành hàm nhỏ có đầu vào và đầu ra.", "Phân biệt print với return qua trình theo vết.", "Viết hàm chấm điểm và kiểm thử hai trường hợp."),
        courseLesson("lesson-12", "Dự án: Trò chơi hỏi–đáp", "PYTHON_PROJECT", 120, "LOCKED", "Lập kế hoạch và hoàn thiện một chương trình nhiều phần.", "Ghép list, hàm, điều kiện và vòng lặp; kiểm thử theo checklist.", "Nộp sản phẩm, giải thích quyết định và làm checkpoint 8 câu.")
      ]
    }
  ]
} as const;

export const games = [
  { slug: "code-order", title: "Sắp xếp chương trình", description: "Đưa các dòng code về đúng thứ tự và giải thích vai trò từng dòng", asset: "game-asset-01", xp: 35, color: "purple" },
  { slug: "predict-output", title: "Dự đoán kết quả", description: "Theo vết chương trình trước khi chạy", asset: "game-asset-02", xp: 30, color: "blue" },
  { slug: "bug-hunter", title: "Phòng sửa lỗi", description: "Tìm bằng chứng, xác định nguyên nhân và áp dụng bản sửa", asset: "game-asset-03", xp: 40, color: "orange" },
  { slug: "range-runner", title: "Mô phỏng range()", description: "Đi qua từng giá trị để hiểu chính xác điểm dừng", asset: "game-asset-04", xp: 45, color: "green" }
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
  weak: ["range()", "while", "if/else", "list"][index % 4] ?? "range()",
  grade: 6 + (index % 4),
  goal: ["Tạo trò chơi hỏi–đáp", "Củng cố tư duy logic", "Chuẩn bị CLB Tin học", "Học theo tốc độ riêng"][index % 4] ?? "Củng cố tư duy logic",
  weeklyMinutes: [90, 120, 150, 75, 180][index % 5] ?? 120,
  device: index % 6 === 0 ? "Điện thoại dùng chung" : index % 3 === 0 ? "Máy tính bảng" : "Máy tính",
  connectivity: index % 7 === 0 ? "Chập chờn" : index % 5 === 0 ? "Thỉnh thoảng offline" : "Ổn định",
  dataQuality: index % 9 === 0 ? "Có event gửi muộn" : index % 7 === 0 ? "Ít dữ liệu" : "Đủ dùng"
}));

export const genericStudentPages: Record<string, { eyebrow: string; title: string; description: string; illustration: string }> = {
  onboarding: { eyebrow: "Thiết lập 2 phút", title: "Mục tiêu của Minh", description: "Chọn sản phẩm muốn tạo và thời gian học để hệ thống cân đối lộ trình.", illustration: "personalized-path" },
  course: { eyebrow: "4 module · 12 bài · 6 tuần", title: "Python căn bản cho học sinh", description: "Từ câu lệnh đầu tiên đến trò chơi hỏi–đáp qua bài học 3 pha và lộ trình cá nhân.", illustration: "skill-mastery" },
  lesson: { eyebrow: "Nhiệm vụ 5", title: "Khám phá hàm range()", description: "Theo dấu robot Mầm qua một dãy số và tìm vạch dừng.", illustration: "code-challenge" },
  profile: { eyebrow: "Hồ sơ học tập", title: "Minh 🌱", description: "Mục tiêu 4 tuần, 120 phút mỗi tuần và quyền riêng tư cho dữ liệu demo.", illustration: "progress" }
};

export const genericTeacherPages: Record<string, { eyebrow: string; title: string; description: string; illustration: string }> = {
  classes: { eyebrow: "1 lớp pilot", title: "Python Explorers", description: "20 học viên với mức đầu vào, tốc độ và rủi ro quên khác nhau.", illustration: "class-dashboard" },
  "course-builder": { eyebrow: "Course builder", title: "4 module · 12 bài học", description: "Mỗi bài có lý thuyết, thực hành, kiểm tra; lộ trình vẫn thay đổi theo evidence từng học sinh.", illustration: "knowledge-graph" },
  exercises: { eyebrow: "Exercise manager", title: "50 hoạt động đang dùng", description: "Trắc nghiệm, code order, predict output, bug hunter và game.", illustration: "code-challenge" },
  sources: { eyebrow: "Knowledge sources", title: "Nguồn học liệu đã xác thực", description: "TXT, PDF, DOCX và PPTX được kiểm tra MIME, kích thước và tách chunk.", illustration: "upload" },
  upload: { eyebrow: "Safe upload", title: "Thêm tài liệu tham khảo", description: "Không chạy macro, script hoặc nội dung nhúng; teacher luôn duyệt output.", illustration: "upload" },
  jobs: { eyebrow: "Generation jobs", title: "Theo dõi content pipeline", description: "Context → JSON → validation → DRAFT, kèm provider, thời gian và chi phí.", illustration: "ai-generation" },
  "review-history": { eyebrow: "Audit trail", title: "Lịch sử kiểm duyệt", description: "Mỗi chỉnh sửa, phê duyệt và xuất bản đều có version và diff.", illustration: "teacher-review" },
  "content-analytics": { eyebrow: "Content production", title: "Tạo một lần, tái sử dụng đúng chỗ", description: "Đo thời gian tạo, thời gian giáo viên sửa, chi phí và reuse count.", illustration: "ai-generation" },
  leaderboard: { eyebrow: "Class settings", title: "Bảng xếp hạng là tùy chọn", description: "Dùng nickname; hỗ trợ most improved, consistent learner và recall master.", illustration: "leaderboard" }
};
