import { ArrowRight, CircleDotDashed, Ruler } from "lucide-react";

export function PatternCard({ pattern, selected = false, onOpen, compact = false }) {
  return (
    <article
      className={`pattern-card ${selected ? "is-selected" : ""}`}
      id={`pattern-${pattern.id}`}
    >
      <header>
        <div>
          <p className="eyebrow">{pattern.type} · {pattern.designer}</p>
          <h3>{pattern.name}</h3>
        </div>
        <strong className="match-score">{pattern.match}%</strong>
      </header>
      <p>{pattern.description}</p>
      <div className="pattern-meta">
        <span><CircleDotDashed size={16} aria-hidden="true" /> {pattern.thickness.toUpperCase()}</span>
        <span><Ruler size={16} aria-hidden="true" /> {pattern.meters} m</span>
      </div>
      <div className="size-list" aria-label="Dostępne rozmiary">
        {pattern.sizes.map((size) => <span key={size}>{size}</span>)}
      </div>
      {!compact && onOpen ? (
        <button className="text-button" type="button" onClick={() => onOpen(pattern.id)}>
          Zobacz w katalogu <ArrowRight size={16} aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}
