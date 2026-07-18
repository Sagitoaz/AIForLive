import { TeacherViewRouter } from "@/features/teacher/teacher-view-router";

export default async function TeacherViewPage({ params }: { params: Promise<{ view: string[] }> }) {
  const { view } = await params;
  return <TeacherViewRouter path={view.join("/")} />;
}
