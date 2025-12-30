/**
 * Mission Catalog UI - Create/Edit Workflow View
 *
 * Form interface for creating new workflows or editing existing ones.
 * Provides schema builders and step composition tools.
 */

import { useState } from 'react';
import { z } from 'zod';

export type CreateWorkflowViewProps = {
  mode: 'create' | 'edit';
  initialWorkflow?: {
    id?: string;
    name: string;
    description?: string;
    inputSchema: any;
    outputSchema: any;
    steps: WorkflowStepConfig[];
  };
  onSave: (workflow: WorkflowConfig) => Promise<void>;
  onCancel: () => void;
};

export type WorkflowStepConfig = {
  id: string;
  name: string;
  type: 'execute' | 'branch' | 'parallel' | 'suspend';
  inputSchema: any;
  outputSchema: any;
  condition?: string; // For branch steps
};

export type WorkflowConfig = {
  name: string;
  description?: string;
  inputSchema: any;
  outputSchema: any;
  steps: WorkflowStepConfig[];
};

/**
 * Create/Edit Workflow View Component
 *
 * Provides a form-based interface for workflow creation and editing.
 */
export function CreateWorkflowView({
  mode,
  initialWorkflow,
  onSave,
  onCancel,
}: CreateWorkflowViewProps) {
  const [name, setName] = useState(initialWorkflow?.name || '');
  const [description, setDescription] = useState(initialWorkflow?.description || '');
  const [inputSchema, setInputSchema] = useState(
    initialWorkflow?.inputSchema || { type: 'object' }
  );
  const [outputSchema, setOutputSchema] = useState(
    initialWorkflow?.outputSchema || { type: 'object' }
  );
  const [steps, setSteps] = useState<WorkflowStepConfig[]>(
    initialWorkflow?.steps || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const workflow: WorkflowConfig = {
        name,
        description,
        inputSchema,
        outputSchema,
        steps,
      };

      await onSave(workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
      setIsSaving(false);
    }
  };

  const addStep = () => {
    const newStep: WorkflowStepConfig = {
      id: `step-${steps.length + 1}`,
      name: `Step ${steps.length + 1}`,
      type: 'execute',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index: number, updates: Partial<WorkflowStepConfig>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  return (
    <div className="create-workflow-view">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onCancel}
          className="px-3 py-1 border rounded-md hover:bg-muted"
        >
          Cancel
        </button>
        <h1 className="text-2xl font-bold">
          {mode === 'create' ? 'Create Workflow' : 'Edit Workflow'}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="My Workflow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
              placeholder="Describe what this workflow does..."
            />
          </div>
        </div>

        {/* Schemas */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Input Schema (JSON)
            </label>
            <textarea
              value={JSON.stringify(inputSchema, null, 2)}
              onChange={(e) => {
                try {
                  setInputSchema(JSON.parse(e.target.value));
                  setError(null);
                } catch (err) {
                  setError('Invalid JSON in input schema');
                }
              }}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
              rows={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Output Schema (JSON)
            </label>
            <textarea
              value={JSON.stringify(outputSchema, null, 2)}
              onChange={(e) => {
                try {
                  setOutputSchema(JSON.parse(e.target.value));
                  setError(null);
                } catch (err) {
                  setError('Invalid JSON in output schema');
                }
              }}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
              rows={10}
            />
          </div>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Steps</h2>
            <button
              type="button"
              onClick={addStep}
              className="px-4 py-2 border rounded-md hover:bg-muted"
            >
              + Add Step
            </button>
          </div>

          {steps.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No steps yet. Click "Add Step" to create one.
            </p>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="p-4 border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) =>
                        updateStep(index, { name: e.target.value })
                      }
                      className="flex-1 px-2 py-1 border rounded mr-2"
                      placeholder="Step name"
                    />
                    <select
                      value={step.type}
                      onChange={(e) =>
                        updateStep(index, {
                          type: e.target.value as WorkflowStepConfig['type'],
                        })
                      }
                      className="px-2 py-1 border rounded mr-2"
                    >
                      <option value="execute">Execute</option>
                      <option value="branch">Branch</option>
                      <option value="parallel">Parallel</option>
                      <option value="suspend">Suspend</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="px-3 py-1 text-destructive hover:bg-destructive/10 rounded"
                    >
                      Remove
                    </button>
                  </div>

                  {step.type === 'branch' && (
                    <input
                      type="text"
                      value={step.condition || ''}
                      onChange={(e) =>
                        updateStep(index, { condition: e.target.value })
                      }
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Condition (e.g., inputData.approved === true)"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !name || steps.length === 0}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
