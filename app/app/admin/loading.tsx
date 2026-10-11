export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading admin">
      <div className="skeleton h-10 w-72" />
      <div className="skeleton h-5 w-96 max-w-full" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton mt-2 h-20 w-full rounded-3xl" />
      ))}
    </div>
  );
}
