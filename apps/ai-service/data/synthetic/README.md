# Synthetic pilot dataset

SYNTHETIC DATA — NOT REAL EDUONE DATA

- Seed: 20260718
- Quy mô pilot: 1 lớp, 20 học sinh, 48 bài tập, 400 attempts
- Hồ sơ có khối lớp, mục tiêu, quỹ thời gian, thiết bị dùng chung và chất lượng kết nối khác nhau.
- Dữ liệu không hoàn hảo có kiểm soát: event gửi muộn, offline batch, phản hồi quá nhanh/chậm, lượt bỏ qua và học sinh ít dữ liệu.
- Không cố tình làm hỏng khóa chính hoặc nhãn hàng loạt; mỗi bất thường đều có `data_quality_flags` để pipeline có thể lọc hoặc giảm trọng số.
- Toàn bộ tên và hành vi là synthetic, không phải dữ liệu thật của EduOne.
