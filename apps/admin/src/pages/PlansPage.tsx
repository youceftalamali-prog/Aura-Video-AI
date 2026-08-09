import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Spinner, Badge } from '@aura/ui';
import { adminApi } from '../lib/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  creditsPerMonth: number;
  isActive: boolean;
  features: string[];
}

export function PlansPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => adminApi.listPlans() as Promise<Plan[]>,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Plans</h1>
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}
      {error && <p className="text-red-600">Failed to load plans</p>}
      {data && (
        <div className="grid gap-6 sm:grid-cols-2">
          {data.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  <Badge variant={plan.isActive ? 'success' : 'default'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">{plan.description}</p>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  ${plan.priceMonthly}
                  <span className="text-sm font-normal text-slate-500">/mo</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{plan.creditsPerMonth} credits / month</p>
                <ul className="mt-4 space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-slate-600">
                      · {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
