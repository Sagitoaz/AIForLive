"use client";

import Image from "next/image";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="center-page">
      <Image src="/assets/empty-states/illustration-system-error.svg" alt="Trợ lý đang sửa kết nối" width={360} height={260} />
      <h1>Kết nối học tập bị gián đoạn</h1>
      <p>Không thể tải dữ liệu từ hệ thống lúc này. Hãy kiểm tra API và Supabase rồi thử lại.</p>
      <button className="button primary" onClick={reset}>Thử lại</button>
    </main>
  );
}
