import PageHeader from '../../../components/common/PageHeader';
import CampaignWizard from '../components/CampaignWizard';

export default function NewCampaignPage() {
  return (
    <div>
      <PageHeader
        title="Create Campaign"
        subtitle="Set up a new SMS campaign in a few simple steps"
      />
      <CampaignWizard />
    </div>
  );
}

