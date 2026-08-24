interface GuidedTourDotsProps {
  currentIndex: number;
  totalSteps: number;
}

export function GuidedTourDots({ currentIndex, totalSteps }: {
  currentIndex: number;
  totalSteps: number;
}) {
  return (
    <div className="guided-tour-dots" role="tablist" aria-label="Progreso del tutorial">
      {Array.from({ length: totalSteps }, (_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === currentIndex}
          aria-label={`Paso ${i + 1}`}
          className={`guided-tour-dot ${i === currentIndex ? "active" : ""}`}
          disabled
        />
      ))}
    </div>
  );
}