import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Spinner, Badge } from '@aura/ui';
import { adminApi } from '../lib/api';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
}

export function UsersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers() as Promise<AdminUser[]>,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Users</h1>
      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {error && <p className="text-red-600">Failed to load users</p>}
          {data && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100">
                      <td className="py-3 font-medium text-slate-900">{u.fullName}</td>
                      <td className="py-3 text-slate-600">{u.email}</td>
                      <td className="py-3">
                        <Badge variant={u.role === 'admin' || u.role === 'superadmin' ? 'info' : 'default'}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={u.status === 'active' ? 'success' : 'warning'}>{u.status}</Badge>
                      </td>
                      <td className="py-3 text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length === 0 && <p className="py-6 text-center text-slate-500">No users yet</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
