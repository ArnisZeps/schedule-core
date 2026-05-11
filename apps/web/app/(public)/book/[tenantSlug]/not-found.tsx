export default function BookNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">Business not found</h1>
      <p className="text-muted-foreground">
        The booking page you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
    </div>
  )
}
