import { cn } from '@/lib/utils'

type SessionLoaderProps = {
  title: string
  subtitle?: string | null
  fullScreen?: boolean
}

export function SessionLoader({
  title,
  subtitle,
  fullScreen = true,
}: SessionLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-4',
        fullScreen ? 'h-dvh bg-muted/40' : 'min-h-80 flex-1 py-12',
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div
        className="h-1 w-56 overflow-hidden rounded-full bg-border"
        aria-hidden="true"
      >
        <div className="session-loader-bar h-full w-2/5 rounded-full bg-foreground/70" />
      </div>
    </div>
  )
}
