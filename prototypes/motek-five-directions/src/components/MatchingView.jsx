import { ArrowLeft, Sparkles } from "lucide-react";
import { MATCHES } from "../model/demo-data.mjs";
import { PatternCard } from "./PatternCard.jsx";

export function MatchingView({ inventory, dispatch }) {
  const totalLength = inventory.reduce((sum, yarn) => sum + yarn.length, 0);

  return (
    <section className="view matching-view" aria-labelledby="matching-title">
      <header className="view-header">
        <div>
          <p className="eyebrow">Pomysły z Twojego zapasu</p>
          <h1 id="matching-title">Dopasowanie</h1>
          <p>Wzory, które możesz zacząć z materiałów znajdujących się w magazynie.</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => dispatch({ type: "NAVIGATE", screen: "inventory" })}
        >
          <ArrowLeft size={18} aria-hidden="true" /> Wróć do magazynu
        </button>
      </header>

      {inventory.length === 0 ? (
        <div className="empty-state surface">
          <Sparkles size={30} aria-hidden="true" />
          <h2>Dodaj włóczkę, aby znaleźć dopasowanie</h2>
          <p>Wystarczy jeden zapisany motek, żeby rozpocząć poszukiwania.</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => dispatch({ type: "NAVIGATE", screen: "inventory" })}
          >
            Przejdź do magazynu
          </button>
        </div>
      ) : (
        <>
          <div className="match-summary surface">
            <Sparkles size={24} aria-hidden="true" />
            <div>
              <strong>{inventory.length} motków · {totalLength.toLocaleString("pl-PL")} m</strong>
              <span>Twój zapas pasuje do 3 wyróżnionych projektów.</span>
            </div>
          </div>
          <div className="matching-grid">
            {MATCHES.map((pattern) => (
              <PatternCard
                key={pattern.id}
                pattern={pattern}
                onOpen={(patternId) => dispatch({ type: "OPEN_PATTERN", patternId })}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
