# @mastra/tool-ui

Tool response UI components for @assistant-ui/react integration with Mastra.

## Installation

```bash
pnpm add @mastra/tool-ui
```

## Components

### CodeBlock

Syntax-highlighted code display with support for multiple languages.

```tsx
import { CodeBlock } from '@mastra/tool-ui';

<CodeBlock
  code="console.log('Hello, World!');"
  language="typescript"
  title="example.ts"
  showLineNumbers
/>
```

### DataTable

Flexible table component built on TanStack Table with sorting support.

```tsx
import { DataTable } from '@mastra/tool-ui';

const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
];

<DataTable columns={columns} data={users} title="Users" />
```

### LinkPreview

URL preview card with metadata display.

```tsx
import { LinkPreview } from '@mastra/tool-ui';

<LinkPreview
  url="https://example.com"
  title="Example Domain"
  description="This domain is for use in illustrative examples."
/>
```

## Integration with @assistant-ui/react

```tsx
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { ToolUIProvider, makeAssistantToolUI } from '@mastra/tool-ui';
import { CodeBlock } from '@mastra/tool-ui/code-block';

const ExecuteCodeToolUI = makeAssistantToolUI({
  toolName: 'execute_code',
  render: ({ result }) => (
    <CodeBlock
      code={result.code}
      language={result.language || 'typescript'}
    />
  ),
});

function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ToolUIProvider>
        <Thread />
        <ExecuteCodeToolUI />
      </ToolUIProvider>
    </AssistantRuntimeProvider>
  );
}
```

## License

Apache-2.0
