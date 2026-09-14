import { redirect } from 'next/navigation';
import { Workspace } from '../../components/workspace';
export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (['emitters', 'recipients'].includes(slug[0])) redirect('/entities');
  return <Workspace page={slug[0] || 'dashboard'} id={slug[1]} />;
}
