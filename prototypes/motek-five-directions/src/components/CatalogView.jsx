import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect } from "react";
import { FILTER_OPTIONS } from "../model/demo-data.mjs";
import { selectFilteredPatterns } from "../model/prototype-state.mjs";
import { PatternCard } from "./PatternCard.jsx";

export function CatalogView({ state, dispatch }) {
  const patterns = selectFilteredPatterns(state);

  useEffect(() => {
    if (!state.selectedPatternId) return;
    window.setTimeout(() => {
      document.getElementById(`pattern-${state.selectedPatternId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  }, [state.selectedPatternId]);

  return (
    <section className="view catalog-view" aria-labelledby="catalog-title">
      <header className="view-header">
        <div>
          <p className="eyebrow">Biblioteka inspiracji</p>
          <h1 id="catalog-title">Katalog wzorów</h1>
          <p>Filtruj projekty według rodzaju i grubości włóczki.</p>
        </div>
      </header>

      <div className="catalog-tools surface">
        <label className="search-field">
          <span>Szukaj po nazwie lub projektantce</span>
          <span className="input-with-icon">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={state.search}
              placeholder="Np. cardigan"
              onChange={(event) => dispatch({ type: "SET_SEARCH", value: event.target.value })}
            />
          </span>
        </label>
        <label>
          <span>Typ projektu</span>
          <select
            value={state.filters.type}
            onChange={(event) => dispatch({
              type: "SET_FILTER",
              name: "type",
              value: event.target.value,
            })}
          >
            <option value="">Wszystkie typy</option>
            {FILTER_OPTIONS.types.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label>
          <span>Grubość włóczki</span>
          <select
            value={state.filters.thickness}
            onChange={(event) => dispatch({
              type: "SET_FILTER",
              name: "thickness",
              value: event.target.value,
            })}
          >
            <option value="">Wszystkie grubości</option>
            {FILTER_OPTIONS.thicknesses.map((thickness) => (
              <option key={thickness}>{thickness}</option>
            ))}
          </select>
        </label>
        <button
          className="button button-secondary reset-button"
          type="button"
          onClick={() => dispatch({ type: "RESET_FILTERS" })}
          disabled={!state.search && !state.filters.type && !state.filters.thickness}
        >
          <X size={16} aria-hidden="true" /> Wyczyść
        </button>
      </div>

      <div className="catalog-count" role="status">
        <SlidersHorizontal size={17} aria-hidden="true" />
        {patterns.length} z {state.patterns.length} wzorów
      </div>

      {patterns.length ? (
        <div className="catalog-grid">
          {patterns.map((pattern) => (
            <PatternCard
              compact
              key={pattern.id}
              pattern={pattern}
              selected={pattern.id === state.selectedPatternId}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state surface">
          <Search size={30} aria-hidden="true" />
          <h2>Te filtry nie pasują do żadnego wzoru.</h2>
          <p>Zmień kryteria albo wróć do pełnej biblioteki.</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => dispatch({ type: "RESET_FILTERS" })}
          >
            Wyczyść filtry
          </button>
        </div>
      )}
    </section>
  );
}
