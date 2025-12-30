/**
 * @mastra/tool-ui
 *
 * Tool response UI components for @assistant-ui/react.
 * Provides pre-built, rich UI components for displaying tool results.
 */

// Runtime
export {
  ToolUIProvider,
  useToolUIContext,
  makeAssistantToolUI,
} from './runtime/ToolUIProvider';

// Content components
export {
  CodeBlock,
  InlineCode,
  type CodeBlockProps,
  type InlineCodeProps,
} from './components/content/CodeBlock';

export {
  LinkPreview,
  LinkPreviewList,
  type LinkPreviewProps,
  type LinkPreviewListProps,
} from './components/content/LinkPreview';

// Data display components
export {
  DataTable,
  createSimpleColumns,
  type DataTableProps,
  type SimpleColumnDef,
} from './components/data-display/DataTable';

// Utilities
export { cn } from './lib/utils';
