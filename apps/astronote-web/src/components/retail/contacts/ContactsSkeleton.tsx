import { RetailCard } from '@/src/components/retail/RetailCard';

export function ContactsSkeleton() {
  return (
    <RetailCard>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <th key={i} className="px-6 py-3">
                  <div className="h-4 bg-surface-light rounded w-24 animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                  <td key={j} className="px-6 py-4">
                    <div className="h-4 bg-surface-light rounded w-20 animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RetailCard>
  );
}
