"use client";

import Image from "next/image";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="center-page">
      <Image src="/assets/empty-states/illustration-system-error.svg" alt="Mầm đang sửa một mạch điện" width={360} height={260} />
      <h1>Mạch học tập bị ngắt một chút</h1>
      <p>Dữ liệu demo vẫn an toàn. Hãy thử nạp lại màn hình.</p>
      <button className="button primary" onClick={reset}>Thử lại</button>
    </main>
  );
}
