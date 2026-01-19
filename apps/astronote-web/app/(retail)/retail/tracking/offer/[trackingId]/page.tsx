import { redirect } from 'next/navigation';

export default function LegacyRetailOfferRedirect({ params }: { params: { trackingId: string } }) {
  const trackingId = params?.trackingId;
  const target = trackingId ? `/tracking/offer/${encodeURIComponent(trackingId)}` : '/link-not-available';
  redirect(target);
}
