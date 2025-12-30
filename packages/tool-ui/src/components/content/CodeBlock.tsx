import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vsDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '../../lib/utils';

/**
 * Code language mapping for common extensions
 */
const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  md: 'markdown',
  markdown: 'markdown',
};

/**
 * Normalize language string to supported syntax highlighter language
 */
function normalizeLanguage(lang?: string): string {
  if (!lang) return 'typescript';
  const normalized = lang.toLowerCase();
  return LANGUAGE_MAP[normalized] || normalized;
}

/**
 * Props for CodeBlock component
 */
export interface CodeBlockProps {
  /** The code content to display */
  code: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** Optional title/header text */
  title?: string;
  /** Optional filename to display */
  filename?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Starting line number */
  startingLineNumber?: number;
  /** Maximum height before scrolling */
  maxHeight?: string | number;
  /** Additional CSS classes */
  className?: string;
  /** Custom theme (defaults to vscDarkPlus) */
  theme?: 'vs-dark' | 'vsc-dark-plus';
}

/**
 * CodeBlock Component
 *
 * Displays code with syntax highlighting using react-syntax-highlighter.
 * Supports a wide range of programming languages and includes optional
 * header, line numbers, and scrollable container.
 *
 * @example
 * ```tsx
 * <CodeBlock
 *   code="console.log('Hello, World!');"
 *   language="typescript"
 *   title="example.ts"
 *   showLineNumbers
 * />
 * ```
 */
export function CodeBlock({
  code,
  language,
  title,
  filename,
  showLineNumbers = false,
  startingLineNumber = 1,
  maxHeight = '400px',
  className,
  theme = 'vsc-dark-plus',
}: CodeBlockProps) {
  const normalizedLanguage = normalizeLanguage(language);
  const themeStyle = theme === 'vs-dark' ? vsDark : vscDarkPlus;
  const displayTitle = title || filename;

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden border border-border bg-background',
        className
      )}
    >
      {/* Header */}
      {displayTitle && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/50">
          <span className="text-sm font-medium text-foreground">{displayTitle}</span>
          <span className="text-xs text-muted-foreground">{normalizedLanguage}</span>
        </div>
      )}

      {/* Code */}
      <div
        className="overflow-auto"
        style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
      >
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={themeStyle}
          showLineNumbers={showLineNumbers}
          startingLineNumber={startingLineNumber}
          customStyle={{
            margin: 0,
            borderRadius: displayTitle ? '0 0 0.5rem 0.5rem' : '0.5rem',
            fontSize: '0.875rem',
            background: 'transparent',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

/**
 * Inline code component for use within text
 */
export interface InlineCodeProps {
  children: string;
  className?: string;
}

export function InlineCode({ children, className }: InlineCodeProps) {
  return (
    <code
      className={cn(
        'rounded bg-muted px-1.5 py-0.5 text-sm font-medium text-foreground',
        'font-mono [word-break:break-words]',
        className
      )}
    >
      {children}
    </code>
  );
}
