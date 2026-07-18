import type { Metadata } from "next";
import "./globals.css";
import { DemoProvider } from "@/features/demo/demo-context";

export const metadata: Metadata = {
  title: { default: "EduRecall AI", template: "%s · EduRecall AI" },
  description: "Học theo cách bộ não của bạn ghi nhớ — personalization có evidence và nội dung AI do giáo viên kiểm duyệt.",
  applicationName: "EduRecall AI",
  icons: { icon: "/assets/brand/favicon.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
