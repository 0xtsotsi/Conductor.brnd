import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Props for LinkPreview component
 */
export interface LinkPreviewProps {
  /** The URL to link to */
  url: string;
  /** Optional page title */
  title?: string;
  /** Optional page description */
  description?: string;
  /** Optional preview image URL */
  image?: string;
  /** Optional favicon URL */
  favicon?: string;
  /** Additional CSS classes */
  className?: string;
  /** Link target (defaults to _blank) */
  target?: '_blank' | '_self' | '_parent' | '_top';
  /** Whether to show the external link indicator */
  showExternalIcon?: boolean;
  /** Variant style */
  variant?: 'default' | 'compact' | 'card';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get hostname from URL safely
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Get favicon URL from Google's favicon service
 */
function getFaviconUrl(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
}

/**
 * LinkPreview Component
 *
 * Displays a preview card for a URL with metadata including
 * title, description, favicon, and optional preview image.
 * Opens in a new tab with proper security attributes.
 *
 * @example
 * ```tsx
 * <LinkPreview
 *   url="https://example.com"
 *   title="Example Domain"
 *   description="This domain is for use in illustrative examples."
 *   image="https://example.com/preview.png"
 * />
 * ```
 */
export function LinkPreview({
  url,
  title,
  description,
  image,
  favicon,
  className,
  target = '_blank',
  showExternalIcon = true,
  variant = 'default',
  size = 'md',
}: LinkPreviewProps) {
  const hostname = React.useMemo(() => getHostname(url), [url]);
  const faviconUrl = favicon || getFaviconUrl(hostname);

  // Compact variant - minimal inline link
  if (variant === 'compact') {
    return (
      <a
        href={url}
        target={target}
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1.5 text-sm text-primary hover:underline',
          className
        )}
      >
        <Globe className="h-3 w-3 flex-shrink-0" />
        <span className="truncate max-w-[200px]">{title || hostname}</span>
        {showExternalIcon && <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
      </a>
    );
  }

  // Card variant - full preview card
  return (
    <a
      href={url}
      target={target}
      rel="noopener noreferrer"
      className={cn(
        'group flex items-start gap-3 rounded-lg border bg-card p-3',
        'transition-all hover:bg-accent hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        size === 'sm' && 'p-2 gap-2',
        size === 'lg' && 'p-4 gap-4',
        className
      )}
    >
      {/* Image */}
      {image && (
        <div
          className={cn(
            'flex-shrink-0 overflow-hidden rounded bg-muted',
            size === 'sm' && 'h-12 w-12',
            size === 'md' && 'h-16 w-16',
            size === 'lg' && 'h-20 w-20'
          )}
        >
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Favicon (when no image) */}
      {!image && favicon && (
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center rounded bg-muted',
            size === 'sm' && 'h-8 w-8',
            size === 'md' && 'h-10 w-10',
            size === 'lg' && 'h-12 w-12'
          )}
        >
          <img
            src={faviconUrl}
            alt=""
            className="h-4 w-4"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Header with hostname and external link icon */}
        <div className="flex items-center gap-2">
          {favicon && !image && (
            <img
              src={faviconUrl}
              alt=""
              className="h-3.5 w-3.5 flex-shrink-0"
              loading="lazy"
            />
          )}
          <span className="text-xs text-muted-foreground truncate">{hostname}</span>
          {showExternalIcon && (
            <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        {/* Title */}
        {title && (
          <div
            className={cn(
              'truncate font-medium text-foreground group-hover:text-primary transition-colors',
              size === 'sm' && 'text-sm',
              size === 'md' && 'text-base',
              size === 'lg' && 'text-lg'
            )}
          >
            {title}
          </div>
        )}

        {/* Description */}
        {description && (
          <div
            className={cn(
              'line-clamp-2 text-muted-foreground',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base'
            )}
          >
            {description}
          </div>
        )}
      </div>
    </a>
  );
}

/**
 * Props for LinkPreviewList component
 */
export interface LinkPreviewListProps {
  /** Array of link preview props */
  links: Omit<LinkPreviewProps, 'className' | 'variant'>[];
  /** Layout direction */
  direction?: 'vertical' | 'horizontal';
  /** Additional CSS classes */
  className?: string;
}

/**
 * LinkPreviewList Component
 *
 * Displays multiple link previews in a list or grid.
 *
 * @example
 * ```tsx
 * <LinkPreviewList
 *   links={[
 *     { url: 'https://example.com', title: 'Example' },
 *     { url: 'https://google.com', title: 'Google' },
 *   ]}
 * />
 * ```
 */
export function LinkPreviewList({
  links,
  direction = 'vertical',
  className,
}: LinkPreviewListProps) {
  return (
    <div
      className={cn(
        'flex gap-3',
        direction === 'vertical' && 'flex-col',
        direction === 'horizontal' && 'flex-row flex-wrap',
        className
      )}
    >
      {links.map((link, index) => (
        <LinkPreview
          key={index}
          {...link}
          className={cn(
            direction === 'horizontal' && 'flex-1 min-w-[250px]'
          )}
        />
      ))}
    </div>
  );
}
