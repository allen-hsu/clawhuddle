'use client';

import { useState } from 'react';
import type { User } from '@clawteam/shared';
import { apiFetch } from '@/lib/api';

interface Props {
  initialUsers: User[];
}

export function UserTable({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [loadingGateway, setLoadingGateway] = useState<string | null>(null);

  const refresh = async () => {
    const res = await apiFetch<{ data: User[] }>('/api/admin/users');
    setUsers(res.data);
  };

  const addUser = async () => {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail('');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    await apiFetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    await refresh();
  };

  const gatewayAction = async (userId: string, action: 'deploy' | 'start' | 'stop' | 'remove') => {
    setLoadingGateway(userId);
    try {
      switch (action) {
        case 'deploy':
          await apiFetch(`/api/admin/users/${userId}/gateway`, { method: 'POST' });
          break;
        case 'start':
          await apiFetch(`/api/admin/users/${userId}/gateway/start`, { method: 'POST' });
          break;
        case 'stop':
          await apiFetch(`/api/admin/users/${userId}/gateway/stop`, { method: 'POST' });
          break;
        case 'remove':
          await apiFetch(`/api/admin/users/${userId}/gateway`, { method: 'DELETE' });
          break;
      }
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingGateway(null);
    }
  };

  const openGateway = (user: User) => {
    const hostname = window.location.hostname;
    window.open(`http://${hostname}:${user.gateway_port}/?token=${user.gateway_token}`, '_blank');
  };

  const gatewayStatusBadge = (user: User) => {
    if (!user.gateway_status) {
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">not deployed</span>;
    }
    if (user.gateway_status === 'running') {
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">running</span>;
    }
    if (user.gateway_status === 'stopped') {
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">stopped</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{user.gateway_status}</span>;
  };

  const gatewayActions = (user: User) => {
    const isLoading = loadingGateway === user.id;
    if (isLoading) {
      return <span className="text-xs text-gray-400">working...</span>;
    }

    if (!user.gateway_status) {
      return (
        <button onClick={() => gatewayAction(user.id, 'deploy')} className="text-xs text-blue-600 hover:underline">
          Deploy
        </button>
      );
    }

    if (user.gateway_status === 'running') {
      return (
        <span className="flex gap-2">
          <button onClick={() => openGateway(user)} className="text-xs text-green-600 hover:underline">
            Open
          </button>
          <button onClick={() => gatewayAction(user.id, 'stop')} className="text-xs text-yellow-600 hover:underline">
            Stop
          </button>
          <button onClick={() => gatewayAction(user.id, 'remove')} className="text-xs text-red-600 hover:underline">
            Remove
          </button>
        </span>
      );
    }

    if (user.gateway_status === 'stopped') {
      return (
        <span className="flex gap-2">
          <button onClick={() => gatewayAction(user.id, 'start')} className="text-xs text-green-600 hover:underline">
            Start
          </button>
          <button onClick={() => gatewayAction(user.id, 'remove')} className="text-xs text-red-600 hover:underline">
            Remove
          </button>
        </span>
      );
    }

    return null;
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="employee@company.com"
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addUser}
          disabled={adding}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Add Employee
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Email</th>
            <th className="pb-3 font-medium">Role</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Gateway</th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="py-3">{user.name || '\u2014'}</td>
              <td className="py-3 text-gray-600">{user.email}</td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.role}
                </span>
              </td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {user.status}
                </span>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  {gatewayStatusBadge(user)}
                  {user.gateway_port && (
                    <span className="text-xs text-gray-400">:{user.gateway_port}</span>
                  )}
                </div>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleStatus(user)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {user.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                  {gatewayActions(user)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <p className="text-center text-gray-400 py-8">No employees yet</p>
      )}
    </div>
  );
}
