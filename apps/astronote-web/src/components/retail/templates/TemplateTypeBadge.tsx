interface TemplateTypeBadgeProps {
  ownerId?: number
  systemUserId?: number
}

export function TemplateTypeBadge({ ownerId, systemUserId = 1 }: TemplateTypeBadgeProps) {
  const isSystem = ownerId === systemUserId;

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isSystem
          ? 'bg-blue-100 text-blue-800'
          : 'bg-green-100 text-green-800'
      }`}
    >
      {isSystem ? 'System' : 'My Template'}
    </span>
  );
}

