import { redirect } from 'next/navigation';

export default function LegacyRetailUnsubscribeRedirect({ params }: { params: { token: string } }) {
  const token = params?.token;
  const target = token ? `/unsubscribe/${encodeURIComponent(token)}` : '/link-not-available';
  redirect(target);
}
