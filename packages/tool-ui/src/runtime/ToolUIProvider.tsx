import { createContext, useContext, ReactNode } from 'react';
import type { ComponentType } from 'react';

/**
 * Tool UI component registration
 */
interface ToolUIRegistration {
  toolName: string;
  component: ComponentType<{ result: unknown }>;
}

/**
 * Tool UI Context
 */
interface ToolUIContextValue {
  registerToolUI: (registration: ToolUIRegistration) => void;
  getToolUI: (toolName: string) => ComponentType<{ result: unknown }> | undefined;
}

const ToolUIContext = createContext<ToolUIContextValue | null>(null);

/**
 * Tool UI Provider
 *
 * Provides context for registering and retrieving tool UI components.
 * This allows components to register custom renderers for specific tool results.
 */
export function ToolUIProvider({ children }: { children: ReactNode }) {
  const toolUIs = new Map<string, ComponentType<{ result: unknown }>>();

  const registerToolUI = (registration: ToolUIRegistration) => {
    toolUIs.set(registration.toolName, registration.component);
  };

  const getToolUI = (toolName: string) => {
    return toolUIs.get(toolName);
  };

  return (
    <ToolUIContext.Provider value={{ registerToolUI, getToolUI }}>
      {children}
    </ToolUIContext.Provider>
  );
}

/**
 * Hook to access Tool UI context
 */
export function useToolUIContext() {
  const context = useContext(ToolUIContext);
  if (!context) {
    throw new Error('useToolUIContext must be used within ToolUIProvider');
  }
  return context;
}

/**
 * Helper to create a tool UI component
 *
 * @example
 * ```tsx
 * const LinkPreviewToolUI = makeAssistantToolUI({
 *   toolName: "get-link-preview",
 *   render: ({ result }) => <LinkPreview {...result} />,
 * });
 * ```
 */
export function makeAssistantToolUI<T = unknown>(options: {
  toolName: string;
  render: (props: { result: T }) => React.JSX.Element;
}) {
  return function ToolUIComponent(props: { result: T }) {
    return options.render(props);
  };
}
