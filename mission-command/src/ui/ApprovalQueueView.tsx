/**
 * Approval Queue UI - Suspended Workflows Awaiting Approval
 *
 * Displays workflows that are suspended and awaiting human approval.
 * Integrates with Mastra workflow API to resume with approve/reject decisions.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { MissionCommandRole } from '@mastra/auth';

export type ApprovalQueueViewProps = {
  currentUserRole: MissionCommandRole;
};

/**
 * Suspended workflow run data structure
 */
type SuspendedRun = {
  runId: string;
  workflowId: string;
  suspendedAt: Date;
  suspendData: {
    reason: string;
    prUrl?: string;
    prNumber?: number;
    [key: string]: any;
  };
  status: string;
};

/**
 * Approval Queue View Component
 *
 * Shows all suspended workflow runs that require human approval.
 * Operators and admins can approve or reject to resume workflows.
 */
export function ApprovalQueueView({ currentUserRole }: ApprovalQueueViewProps) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  // State for feedback textarea
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  // Check permissions - only operators and admins can approve
  const canApprove = currentUserRole === 'admin' || currentUserRole === 'operator';

  // Fetch suspended workflow runs
  // Note: This API endpoint needs to be implemented in Mastra Server
  const { data: suspendedRuns = [], isLoading } = useQuery({
    queryKey: ['suspended-runs'],
    queryFn: async () => {
      // TODO: Implement this API endpoint in Mastra Server
      // For now, return empty array
      console.warn('getSuspendedRuns API not yet implemented in Mastra Server');
      return [];
    },
  });

  // Mutation to resume a workflow with approval decision
  const approveMutation = useMutation({
    mutationFn: async ({ runId, approved, feedbackText }: {
    runId: string;
    approved: boolean;
    feedbackText?: string
  }) => {
      // TODO: Implement resume API endpoint
      // POST /api/workflows/:workflowId/runs/:runId/resume
      const response = await fetch(`/api/workflows/runs/${runId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData: {
            approved,
            feedback: feedbackText,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resume workflow');
      }

      return response.json();
    },
    onSuccess: () => {
      // Refresh the approval queue
      queryClient.invalidateQueries({ queryKey: ['suspended-runs'] });
    },
  });

  const handleApprove = async (runId: string) => {
    setProcessing({ ...processing, [runId]: true });

    try {
      await approveMutation.mutateAsync({
        runId,
        approved: true,
      });
    } catch (error) {
      console.error('Failed to approve workflow:', error);
      alert('Failed to approve workflow. Please try again.');
    } finally {
      setProcessing({ ...processing, [runId]: false });
    }
  };

  const handleReject = async (runId: string) => {
    const feedbackText = feedback[runId];

    if (!feedbackText) {
      alert('Please provide feedback for the rejection.');
      return;
    }

    setProcessing({ ...processing, [runId]: true });

    try {
      await approveMutation.mutateAsync({
        runId,
        approved: false,
        feedbackText,
      });
    } catch (error) {
      console.error('Failed to reject workflow:', error);
      alert('Failed to reject workflow. Please try again.');
    } finally {
      setProcessing({ ...processing, [runId]: false });
      setFeedback({ ...feedback, [runId]: '' });
    }
  };

  return (
    <div className="approval-queue-view container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Approval Queue</h1>
        <p className="text-muted-foreground">
          Workflows awaiting human review and approval
        </p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Loading approval queue...</p>
        </div>
      ) : suspendedRuns.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold mb-2">All Clear!</h2>
          <p className="text-muted-foreground">
            No workflows are currently awaiting approval.
          </p>
        </div>
      ) : (
        /* Approval List */
        <div className="space-y-4">
          {suspendedRuns.map((run) => (
            <ApprovalCard
              key={run.runId}
              run={run}
              feedback={feedback[run.runId] || ''}
              onFeedbackChange={(value) => setFeedback({ ...feedback, [run.runId]: value })}
              onApprove={() => handleApprove(run.runId)}
              onReject={() => handleReject(run.runId)}
              isProcessing={processing[run.runId] || false}
              canApprove={canApprove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Approval Card Component
 *
 * Displays a single suspended workflow with approve/reject actions
 */
type ApprovalCardProps = {
  run: SuspendedRun;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
  canApprove: boolean;
};

function ApprovalCard({
  run,
  feedback,
  onFeedbackChange,
  onApprove,
  onReject,
  isProcessing,
  canApprove,
}: ApprovalCardProps) {
  const { runId, workflowId, suspendedAt, suspendData } = run;
  const { reason, prUrl, prNumber } = suspendData;

  return (
    <div className="border rounded-lg p-6 bg-card">
      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs font-medium rounded-full">
              AWAITING APPROVAL
            </span>
            <span className="text-sm text-muted-foreground">
              {new Date(suspendedAt).toLocaleString()}
            </span>
          </div>
          <h3 className="text-lg font-semibold">
            {workflowId}
          </h3>
          <p className="text-muted-foreground mt-1">
            {reason}
          </p>
        </div>

        {/* PR Link */}
        {prUrl && (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border rounded-md hover:bg-muted text-sm"
          >
            View PR #{prNumber}
          </a>
        )}
      </div>

      {/* Actions */}
      {canApprove && (
        <div className="space-y-4 mt-6 pt-6 border-t">
          {/* Feedback Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Feedback (required for rejection)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => onFeedbackChange(e.target.value)}
              placeholder="Enter feedback for the submitter..."
              className="w-full px-3 py-2 border rounded-md min-h-[80px] text-sm"
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : '✓ Approve'}
            </button>
            <button
              onClick={onReject}
              disabled={isProcessing || !feedback}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : '✗ Reject'}
            </button>
          </div>
        </div>
      )}

      {/* Viewer-only message */}
      {!canApprove && (
        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
          You have view-only access. Contact an admin or operator to approve this workflow.
        </div>
      )}
    </div>
  );
}

/**
 * Export component
 */
export default ApprovalQueueView;
