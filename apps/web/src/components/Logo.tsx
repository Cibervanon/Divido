export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return <img src="/logo.svg" alt="Divido" className={className} draggable={false} />;
}
