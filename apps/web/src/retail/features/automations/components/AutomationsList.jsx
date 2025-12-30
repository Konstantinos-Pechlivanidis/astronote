import AutomationCard from './AutomationCard';

export default function AutomationsList({ automations }) {
  if (!automations) return null;

  const automationList = [];
  if (automations.welcome) {
    automationList.push(automations.welcome);
  }
  if (automations.birthday) {
    automationList.push(automations.birthday);
  }

  if (automationList.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-500 text-center">No automations available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {automationList.map((automation) => (
        <AutomationCard key={automation.id} automation={automation} />
      ))}
    </div>
  );
}

