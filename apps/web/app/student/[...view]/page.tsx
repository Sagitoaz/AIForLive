import { StudentViewRouter } from "@/features/student/student-view-router";

export default async function StudentViewPage({ params }: { params: Promise<{ view: string[] }> }) {
  const { view } = await params;
  return <StudentViewRouter path={view.join("/")} />;
}
