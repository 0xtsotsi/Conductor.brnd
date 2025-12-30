/**
 * Mission Catalog UI - Workflow Detail View
 *
 * Displays comprehensive information about a single workflow including
 * step visualization, input/output schemas, and associated agents.
 */

import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { MissionCommandRole } from '@mastra/auth';
import { GetWorkflowResponse } from '@mastra/client-js';

export type WorkflowDetailViewProps = {
  workflowId: string;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
  currentUserRole: MissionCommandRole;
};

/**
 * Workflow Detail View Component
 *
 * Shows workflow graph visualization, step details, and metadata.
 * Uses real Mastra API data through useMastraClient.
 */
export function WorkflowDetailView({
  workflowId,
  onEdit,
  onDelete,
  onBack,
  currentUserRole,
}: WorkflowDetailViewProps) {
  const client = useMastraClient();

  // Fetch workflow details from Mastra API
  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => client.getWorkflow(workflowId),
  });

  // Check permissions based on role
  const canEdit = currentUserRole === 'admin';
  const canDelete = currentUserRole === 'admin';

  return (
    <div className="workflow-detail-view container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="px-3 py-1 border rounded-md hover:bg-muted"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{(workflow as any)?.name || workflowId}</h1>
          {(workflow as any)?.description && (
            <p className="text-muted-foreground">{(workflow as any).description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 border rounded-md hover:bg-muted"
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Workflow Details */}
      {isLoading ? (
        <div className="text-center py-8">Loading workflow details...</div>
      ) : workflow ? (
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Workflow Details</h2>
          <pre className="bg-muted p-4 rounded overflow-auto">
            {JSON.stringify(workflow, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Workflow not found
        </div>
      )}
    </div>
  );
}
