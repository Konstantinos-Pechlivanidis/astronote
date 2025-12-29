import PublicLayout from '../layouts/PublicLayout';
import PublicCard from '../components/PublicCard';
import PublicError from '../components/PublicError';

export default function LinkExpiredPage() {
  return (
    <PublicLayout>
      <PublicCard>
        <PublicError
          title="Link Expired"
          message="This link is no longer valid or has expired. Please contact the store for assistance or try again from a more recent message."
        />
      </PublicCard>
    </PublicLayout>
  );
}

