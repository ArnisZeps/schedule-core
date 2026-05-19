export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="h-7 w-24 rounded-md bg-muted" />
        <div className="h-9 w-28 rounded-md bg-muted" />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 flex gap-4">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-4 border-b last:border-0">
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-4 w-52 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
