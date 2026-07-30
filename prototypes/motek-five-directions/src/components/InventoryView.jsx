import { ArrowRight, Edit3, Plus } from "lucide-react";

export function InventoryView({ variant, inventory, dispatch }) {
  const totalWeight = inventory.reduce((sum, yarn) => sum + yarn.weight, 0);
  const totalLength = inventory.reduce((sum, yarn) => sum + yarn.length, 0);
  const colors = new Set(inventory.map((yarn) => yarn.color)).size;

  return (
    <section className="view inventory-view" aria-labelledby="inventory-title">
      <div className="page-hero">
        <div className="hero-copy">
          <p className="eyebrow">{variant.eyebrow}</p>
          <h1 id="inventory-title">Magazyn włóczek</h1>
          <p className="hero-lead">
            Zobacz swój zapas, uzupełnij go i wybierz włóczki do kolejnego projektu.
          </p>
          <div className="hero-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => dispatch({ type: "NAVIGATE", screen: "matching" })}
            >
              Dobierz wzór <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => dispatch({ type: "OPEN_YARN_DIALOG" })}
            >
              <Plus size={18} aria-hidden="true" /> Dodaj motek
            </button>
          </div>
        </div>
        <figure className="visual-card">
          <img
            src={variant.asset}
            alt={`Kot i włóczki — kierunek ${variant.name}`}
          />
        </figure>
      </div>

      <div className="summary-grid" aria-label="Podsumowanie magazynu">
        <Summary label="Motki" value={inventory.length} suffix="w magazynie" />
        <Summary label="Łączna długość" value={totalLength.toLocaleString("pl-PL")} suffix="metrów" />
        <Summary label="Łączna waga" value={totalWeight.toLocaleString("pl-PL")} suffix="gramów" />
        <Summary label="Kolory" value={colors} suffix="w palecie" />
      </div>

      <article className="inventory-panel surface">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Twoje materiały</p>
            <h2>Twój zapas</h2>
            <p>Każdy motek jest gotowy do edycji i dopasowania do projektu.</p>
          </div>
          <button
            className="button button-secondary add-yarn-wide"
            type="button"
            onClick={() => dispatch({ type: "OPEN_YARN_DIALOG" })}
          >
            <Plus size={18} aria-hidden="true" /> Dodaj motek
          </button>
        </header>

        <div className="yarn-table" role="list" aria-label="Lista włóczek">
          {inventory.map((yarn) => (
            <div className="yarn-row" role="listitem" key={yarn.id}>
              <span className="color-swatch" style={{ "--swatch": yarn.hex }} aria-hidden="true" />
              <div className="yarn-primary">
                <strong>{yarn.name}</strong>
                <span>{yarn.brand || "Niezależna przędzalnia"}</span>
              </div>
              <dl>
                <div><dt>Kolor</dt><dd>{yarn.color}</dd></div>
                <div><dt>Skład</dt><dd>{yarn.material}</dd></div>
                <div><dt>Grubość</dt><dd>{yarn.thickness.toUpperCase()}</dd></div>
                <div><dt>Waga / długość</dt><dd>{yarn.weight} g · {yarn.length} m</dd></div>
              </dl>
              <button
                className="edit-button"
                type="button"
                onClick={() => dispatch({ type: "OPEN_YARN_DIALOG", yarnId: yarn.id })}
              >
                <Edit3 size={16} aria-hidden="true" /> Edytuj
              </button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function Summary({ label, value, suffix }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{suffix}</small>
    </div>
  );
}
