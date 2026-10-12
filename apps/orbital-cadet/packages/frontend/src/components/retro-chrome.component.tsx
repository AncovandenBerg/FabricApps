import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Windows 95 chrome primitives.
 *
 * The bevels are CSS inset shadows rather than images (see `global.css`), so
 * they stay crisp at any zoom and need no assets. The title-bar glyphs are
 * decorative: a web page has no window manager to minimise to, and dressing
 * dead controls up as real ones would be worse than leaving them inert, so
 * they are hidden from assistive technology.
 */
export function RetroWindow({
  title,
  children,
  className,
  bodyClassName,
  headingLevel = 2,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** The title bar is the window's real heading, so it carries the level. */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section
      className={cn(
        'bevel-raised flex min-h-0 flex-col bg-card p-100',
        className
      )}
    >
      <div
        className="flex shrink-0 items-center justify-between px-100 py-100-nudge"
        style={{
          background: 'linear-gradient(90deg, #000080 0%, #1084d0 100%)',
        }}
      >
        <Heading className="truncate text-200 font-bold text-white">
          {title}
        </Heading>
        <span aria-hidden="true" className="flex gap-100-nudge">
          <TitleGlyph label="_" />
          <TitleGlyph label="□" />
          <TitleGlyph label="✕" />
        </span>
      </div>

      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

function TitleGlyph({ label }: { label: string }) {
  return (
    <span className="bevel-raised grid h-[14px] w-[16px] place-items-center bg-card text-[9px] leading-none text-black">
      {label}
    </span>
  );
}

/** A 95 menu bar. Items are real buttons — nothing here is a dead label. */
export function RetroMenuBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-100 border-b border-b-bevel-shadow bg-card px-100 py-100-nudge">
      {children}
    </div>
  );
}

export function RetroMenuItem({
  children,
  ...props
}: ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      type="button"
      className="px-200 py-100-nudge text-200 text-black hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:outline-none"
      {...props}
    >
      {children}
    </button>
  );
}

export function RetroButton({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'bevel-raised bg-card px-400 py-200-nudge text-200 text-black active:bevel-pressed disabled:text-bevel-shadow',
        'focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-[-4px]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** A recessed status-bar cell, as used along the bottom of a 95 window. */
export function RetroStatusCell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bevel-inset flex min-w-0 items-baseline gap-200 px-200 py-100',
        className
      )}
    >
      <span className="shrink-0 text-200 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

/** The sunken well that holds a playfield or a list box. */
export function RetroWell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bevel-sunken min-h-0 bg-black p-100', className)}>
      {children}
    </div>
  );
}
