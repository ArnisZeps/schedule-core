export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="h-7 w-16 rounded-md bg-muted" />
        <div className="h-9 w-24 rounded-md bg-muted" />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="h-4 w-28 rounded bg-muted" />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 flex gap-4">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-4 border-b last:border-0">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-44 rounded bg-muted" />
            <div className="h-5 w-14 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
