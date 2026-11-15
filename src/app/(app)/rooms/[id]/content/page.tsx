import { ContentPicker } from '@/components/content/ContentPicker';

export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContentPicker roomId={id} />;
}
