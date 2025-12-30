import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';

/**
 * Audit Log Page
 *
 * Admin-only page for viewing and filtering audit logs.
 * Shows all authentication, authorization, and user management events.
 *
 * Features:
 * - Table view of audit events
 * - Filters: action type, user, date range, success/failure
 * - Pagination: 50 events per page
 * - Export to CSV
 * - Search by user, resource, action
 */

interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
  success?: boolean;
  errorMessage?: string;
}

interface AuditLogResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export function AuditLogPage() {
  const { user } = useAuth();
  const API_URL = import.meta.env.VITE_MASTRA_API_URL || '';

  // State
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Redirect non-admins
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-mastra-bg-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-mastra-el-text mb-4">Access Denied</h1>
          <p className="text-mastra-el-text-muted">You must be an admin to view audit logs.</p>
        </div>
      </div>
    );
  }

  // Fetch audit logs
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      if (actionFilter) params.append('action', actionFilter);
      if (successFilter) params.append('success', successFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (search) params.append('search', search);

      const token = localStorage.getItem('mastra_jwt');
      const response = await fetch(`${API_URL}/api/audit/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data: AuditLogResult = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  // Export logs to CSV
  const exportLogs = async () => {
    try {
      const token = localStorage.getItem('mastra_jwt');
      const response = await fetch(`${API_URL}/api/audit/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: {
            action: actionFilter || undefined,
            success: successFilter === '' ? undefined : successFilter === 'true',
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            search: search || undefined,
          },
          limit: 10000,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export logs');
      }

      // Download CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export logs');
    }
  };

  // Clear filters
  const clearFilters = () => {
    setActionFilter('');
    setSuccessFilter('');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setPage(0);
  };

  // Initial load and when filters/page change
  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, successFilter, startDate, endDate, search]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Get action badge color
  const getActionBadgeColor = (action: string) => {
    if (action.includes('login')) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (action.includes('logout')) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    if (action.includes('failed') || action.includes('denied')) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (action.includes('approved')) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (action.includes('declined')) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-mastra-el-3 text-mastra-el-text';
  };

  return (
    <div className="min-h-screen bg-mastra-bg-1 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-mastra-el-text">Audit Logs</h1>
            <p className="text-mastra-el-text-muted mt-1">
              View and filter all authentication, authorization, and user management events
            </p>
          </div>
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-mastra-el-accent hover:bg-mastra-el-accent-hover text-white rounded-md transition-colors"
          >
            Export to CSV
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-mastra-el-error/10 border border-mastra-el-error rounded-md">
            <p className="text-sm text-mastra-el-error">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 p-4 bg-mastra-el-3 border border-mastra-el-4 rounded-md">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-mastra-el-text mb-1">
                Action
              </label>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-4 rounded-md text-mastra-el-text"
              >
                <option value="">All Actions</option>
                <option value="user.login">User Login</option>
                <option value="user.logout">User Logout</option>
                <option value="user.session.created">Session Created</option>
                <option value="user.role.changed">Role Changed</option>
                <option value="workflow.approved">Workflow Approved</option>
                <option value="workflow.declined">Workflow Declined</option>
                <option value="auth.permission.denied">Permission Denied</option>
              </select>
            </div>

            {/* Success Filter */}
            <div>
              <label className="block text-sm font-medium text-mastra-el-text mb-1">
                Status
              </label>
              <select
                value={successFilter}
                onChange={(e) => {
                  setSuccessFilter(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-4 rounded-md text-mastra-el-text"
              >
                <option value="">All</option>
                <option value="true">Success</option>
                <option value="false">Failure</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-mastra-el-text mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-4 rounded-md text-mastra-el-text"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-mastra-el-text mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-4 rounded-md text-mastra-el-text"
              />
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-mastra-el-text mb-1">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search logs..."
                className="w-full px-3 py-2 bg-mastra-bg-1 border border-mastra-el-4 rounded-md text-mastra-el-text"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-sm bg-mastra-el-4 hover:bg-mastra-el-5 text-mastra-el-text rounded-md transition-colors"
            >
              Clear Filters
            </button>
            <button
              onClick={fetchLogs}
              className="px-3 py-1 text-sm bg-mastra-el-accent hover:bg-mastra-el-accent-hover text-white rounded-md transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-mastra-el-3 border border-mastra-el-4 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-mastra-el-4 border-b border-mastra-el-5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase">
                    Resource
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-mastra-el-text-muted uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mastra-el-5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-mastra-el-text-muted">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-mastra-el-text-muted">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-mastra-el-4/50">
                      <td className="px-4 py-3 text-sm text-mastra-el-text">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-md border ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-mastra-el-text">
                        {log.details?.userEmail || log.userId || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-mastra-el-text">
                        {log.resource ? (
                          <span>
                            {log.resource}
                            {log.resourceId && <span className="text-mastra-el-text-muted"> ({log.resourceId})</span>}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-mastra-el-text-muted">
                        {log.ipAddress || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {log.action.includes('failed') || log.action.includes('denied') ? (
                          <span className="inline-flex items-center text-xs text-mastra-el-error">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs text-green-500">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Success
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-mastra-el-4 px-4 py-3 border-t border-mastra-el-5 flex items-center justify-between">
            <div className="text-sm text-mastra-el-text-muted">
              Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total} logs
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm bg-mastra-el-3 hover:bg-mastra-el-5 text-mastra-el-text rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * pageSize >= total}
                className="px-3 py-1 text-sm bg-mastra-el-3 hover:bg-mastra-el-5 text-mastra-el-text rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
