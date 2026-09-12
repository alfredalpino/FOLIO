import { ReaderShell } from "@/components/ReaderShell";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReaderShell bookId={id} />;
}
