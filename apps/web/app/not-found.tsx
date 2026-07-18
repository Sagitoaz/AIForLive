import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <Image src="/assets/empty-states/illustration-course-not-found.svg" alt="Mầm tìm đường" width={360} height={260} />
      <h1>Chưa mở khóa khu vực này</h1>
      <p>Quay về bản đồ để chọn một nhiệm vụ đang hoạt động.</p>
      <Link className="button primary" href="/student">Về dashboard</Link>
    </main>
  );
}
