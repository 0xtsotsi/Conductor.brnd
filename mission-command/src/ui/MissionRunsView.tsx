/**
 * Mission Runs Monitoring UI
 *
 * Displays workflow executions with real-time status updates, step visualization,
 * logs, and controls for canceling running workflows.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { MissionCommandRole } from '@mastra/auth';

export type MissionRunsViewProps = {
  currentUserRole: MissionCommandRole;
};

/**
 * Workflow run data structure
 */
type WorkflowRun = {
  runId: string;
  workflowId: string;
  status: 'running' | 'suspended' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  steps: WorkflowStep[];
  error?: string;
};

/**
 * Workflow step data structure
 */
type WorkflowStep = {
  stepId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'suspended';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  output?: any;
  error?: string;
};

/**
 * Mission Runs Monitoring View Component
 *
 * Shows all workflow runs with filtering, real-time updates, and detailed view.
 */
export function MissionRunsView({ currentUserRole }: MissionRunsViewProps) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'suspended' | 'completed' | 'failed'>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);

  // Check permissions
  const canCancel = currentUserRole === 'admin' || currentUserRole === 'operator';

  // Fetch active workflow runs
  const { data: activeRunsData, isLoading, refetch } = useQuery({
    queryKey: ['missions', 'active'],
    queryFn: async () => {
      const response = await client.get('/api/missions/active?page=0&perPage=50');
      return response;
    },
    // Enable polling for real-time updates
    refetchInterval: 2000,
  });
  const runs = activeRunsData?.runs || [];

  // Cancel workflow mutation
  const cancelMutation = useMutation({
    mutationFn: async (runId: string) => {
      const response = await client.post(`/api/workflows/runs/${runId}/cancel`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions', 'active'] });
    },
  });

  const handleCancel = async (runId: string) => {
    if (!confirm('Are you sure you want to cancel this workflow run?')) {
      return;
    }

    try {
      await cancelMutation.mutateAsync(runId);
      alert('Workflow run cancelled successfully');
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
      alert('Failed to cancel workflow run. Please try again.');
    }
  };

  // Filter runs
  const filteredRuns = runs.filter((run) => {
    if (statusFilter !== 'all' && run.status !== statusFilter) return false;
    if (workflowFilter !== 'all' && run.workflowId !== workflowFilter) return false;
    return true;
  });

  return (
    <div className="mission-runs-view container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mission Runs</h1>
          <p className="text-muted-foreground">
            Monitor and manage workflow executions
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 border rounded-md hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All Status</option>
          <option value="running">Running</option>
          <option value="suspended">Suspended</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>

        <input
          type="text"
          placeholder="Filter by workflow ID..."
          value={workflowFilter}
          onChange={(e) => setWorkflowFilter(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-md"
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Loading workflow runs...</p>
        </div>
      ) : filteredRuns.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-2">No Runs Found</h2>
          <p className="text-muted-foreground">
            {statusFilter === 'all'
              ? 'No workflow executions yet.'
              : `No ${statusFilter} workflow runs found.`}
          </p>
        </div>
      ) : (
        /* Runs List */}
        <div className="space-y-4">
          {filteredRuns.map((run) => (
            <RunCard
              key={run.runId}
              run={run}
              onSelect={() => setSelectedRun(run)}
              onCancel={() => handleCancel(run.runId)}
              isCancelling={cancelMutation.isPending}
              canCancel={canCancel}
              isSelected={selectedRun?.runId === run.runId}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selectedRun && (
        <RunDetailPanel
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  );
}

/**
 * Run Card Component
 *
 * Displays summary of a workflow run
 */
type RunCardProps = {
  run: WorkflowRun;
  onSelect: () => void;
  onCancel: () => void;
  isCancelling: boolean;
  canCancel: boolean;
  isSelected: boolean;
};

function RunCard({ run, onSelect, onCancel, isCancelling, canCancel, isSelected }: RunCardProps) {
  const { runId, workflowId, status, startedAt, completedAt, steps, error } = run;

  // Calculate duration
  const duration = completedAt
    ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
    : Date.now() - new Date(startedAt).getTime();

  const durationText = formatDuration(duration);

  // Status badge
  const statusConfig = {
    running: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Running' },
    suspended: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Suspended' },
    completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Completed' },
    failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Failed' },
  };

  const statusInfo = statusConfig[status];

  // Count step statuses
  const stepCounts = {
    total: steps.length,
    completed: steps.filter((s) => s.status === 'completed').length,
    running: steps.filter((s) => s.status === 'running').length,
    failed: steps.filter((s) => s.status === 'failed').length,
  };

  return (
    <div
      onClick={onSelect}
      className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span className="text-sm text-muted-foreground">
              {new Date(startedAt).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              ({durationText})
            </span>
          </div>
          <h3 className="font-semibold">{workflowId}</h3>
          <p className="text-sm text-muted-foreground">Run ID: {runId}</p>
        </div>

        {/* Cancel Button */}
        {status === 'running' && canCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={isCancelling}
            className="px-3 py-1 text-sm border rounded hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span>Progress</span>
          <span>
            {stepCounts.completed}/{stepCounts.total} steps completed
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{
              width: `${(stepCounts.completed / stepCounts.total) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Error Message */}
      {status === 'failed' && error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Steps Summary */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        {stepCounts.failed > 0 && (
          <span className="text-red-600">✗ {stepCounts.failed} failed</span>
        )}
        {stepCounts.running > 0 && (
          <span className="text-blue-600">◷ {stepCounts.running} running</span>
        )}
      </div>
    </div>
  );
}

/**
 * Run Detail Panel Component
 *
 * Shows detailed view of a workflow run with step tree
 */
type RunDetailPanelProps = {
  run: WorkflowRun;
  onClose: () => void;
};

function RunDetailPanel({ run, onClose }: RunDetailPanelProps) {
  const { runId, workflowId, status, startedAt, completedAt, steps, error } = run;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">{workflowId}</h2>
            <p className="text-sm text-muted-foreground">Run ID: {runId}</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-muted"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="font-medium">{status}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Duration</dt>
              <dd className="font-medium">
                {formatDuration(
                  completedAt
                    ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
                    : Date.now() - new Date(startedAt).getTime()
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Started</dt>
              <dd className="font-medium">{new Date(startedAt).toLocaleString()}</dd>
            </div>
            {completedAt && (
              <div>
                <dt className="text-sm text-muted-foreground">Completed</dt>
                <dd className="font-medium">{new Date(completedAt).toLocaleString()}</dd>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Steps */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Steps</h3>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <StepItem key={step.stepId} step={step} index={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step Item Component
 *
 * Displays a single workflow step with status
 */
type StepItemProps = {
  step: WorkflowStep;
  index: number;
};

function StepItem({ step, index }: StepItemProps) {
  const { name, status, startedAt, completedAt, output, error } = step;

  const statusIcon = {
    pending: '○',
    running: '◷',
    completed: '✓',
    failed: '✗',
    suspended: '⏸',
  }[status];

  const statusColor = {
    pending: 'text-muted-foreground',
    running: 'text-blue-600',
    completed: 'text-green-600',
    failed: 'text-red-600',
    suspended: 'text-yellow-600',
  }[status];

  const stepDuration =
    startedAt && completedAt
      ? formatDuration(new Date(completedAt).getTime() - new Date(startedAt).getTime())
      : startedAt
        ? formatDuration(Date.now() - new Date(startedAt).getTime())
        : '-';

  return (
    <div className="border rounded-md p-3">
      <div className="flex items-start gap-3">
        {/* Step Number */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
          {index + 1}
        </div>

        {/* Step Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`text-2xl ${statusColor}`}>{statusIcon[status]}</span>
            <span className="font-medium">{name}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              status === 'running'
                ? 'bg-blue-100 text-blue-800'
                : status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-muted text-muted-foreground'
            }`}>
              {status}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {stepDuration}
            </span>
          </div>

          {/* Step Output */}
          {output && (
            <details className="mt-2">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                Output
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto">
                {JSON.stringify(output, null, 2)}
              </pre>
            </details>
          )}

          {/* Step Error */}
          {error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm rounded">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Export component
 */
export default MissionRunsView;
