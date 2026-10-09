export default function Skeleton({
  className = "",
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={`ds-skeleton-stack ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="ds-skeleton" />
      ))}
    </div>
  );
}
