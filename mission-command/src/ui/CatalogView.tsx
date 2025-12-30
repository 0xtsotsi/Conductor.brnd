/**
 * Mission Catalog UI - Workflow List View
 *
 * Main interface for browsing, searching, and managing workflow definitions.
 * Leverages @mastra/playground-ui components.
 */

import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { WorkflowTable } from '@mastra/playground-ui/domains/workflows';
import { MissionCommandRole } from '@mastra/auth';

export type CatalogViewProps = {
  onWorkflowSelect: (workflowId: string) => void;
  onWorkflowCreate: () => void;
  currentUserRole: MissionCommandRole;
};

/**
 * Mission Catalog View Component
 *
 * Displays a searchable, filterable list of all workflows with quick actions.
 * Uses real Mastra API data through useMastraClient.
 */
export function CatalogView({
  onWorkflowSelect,
  onWorkflowCreate,
  currentUserRole,
}: CatalogViewProps) {
  const client = useMastraClient();

  // Fetch workflows from Mastra API
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => client.listWorkflows(),
  });

  // Check permissions based on role
  const canCreate = currentUserRole === 'admin' || currentUserRole === 'operator';
  const canDelete = currentUserRole === 'admin';

  return (
    <div className="mission-catalog-view container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mission Catalog</h1>
          <p className="text-muted-foreground">
            Browse and manage workflow definitions
          </p>
        </div>
        {canCreate && (
          <button
            onClick={onWorkflowCreate}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Create Workflow
          </button>
        )}
      </div>

      {/* Workflow Table - handles its own search/filter */}
      <WorkflowTable
        workflows={workflows ?? {}}
        isLoading={isLoading}
      />
    </div>
  );
}
