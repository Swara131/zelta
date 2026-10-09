export default function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`ds-card ${interactive ? "ds-card-interactive" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
