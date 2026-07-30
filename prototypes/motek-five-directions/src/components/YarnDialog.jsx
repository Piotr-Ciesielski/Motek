import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { validateYarnDraft } from "../model/prototype-state.mjs";

const blankYarn = {
  name: "",
  brand: "",
  color: "",
  material: "",
  thickness: "",
  weight: "",
  length: "",
  hex: "#8A6B7B",
};

export function YarnDialog({ open, yarn, onClose, onSave }) {
  const initialDraft = useMemo(() => yarn ?? blankYarn, [yarn]);
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState({});
  const nameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDraft(initialDraft);
      setErrors({});
      window.setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open, initialDraft]);

  if (!open) return null;

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateYarnDraft(draft);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSave(draft);
  }

  return (
    <dialog
      className="yarn-dialog"
      open
      aria-modal="true"
      aria-labelledby="yarn-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form method="dialog" onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Twój magazyn</p>
            <h2 id="yarn-dialog-title">{yarn ? "Edytuj włóczkę" : "Dodaj włóczkę"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Zamknij">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="form-grid">
          <Field label="Nazwa" error={errors.name}>
            <input
              ref={nameRef}
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
          </Field>
          <Field label="Marka">
            <input value={draft.brand} onChange={(event) => update("brand", event.target.value)} />
          </Field>
          <Field label="Kolor" error={errors.color}>
            <input
              value={draft.color}
              onChange={(event) => update("color", event.target.value)}
              aria-invalid={Boolean(errors.color)}
            />
          </Field>
          <Field label="Skład" error={errors.material}>
            <select
              value={draft.material}
              onChange={(event) => update("material", event.target.value)}
              aria-invalid={Boolean(errors.material)}
            >
              <option value="">Wybierz</option>
              <option value="merino">Merino</option>
              <option value="wełna">Wełna</option>
              <option value="alpaka">Alpaka</option>
              <option value="bawełna">Bawełna</option>
              <option value="len">Len</option>
            </select>
          </Field>
          <Field label="Grubość" error={errors.thickness}>
            <select
              value={draft.thickness}
              onChange={(event) => update("thickness", event.target.value)}
              aria-invalid={Boolean(errors.thickness)}
            >
              <option value="">Wybierz</option>
              <option value="lace">Lace</option>
              <option value="fingering">Fingering</option>
              <option value="sport">Sport</option>
              <option value="dk">DK</option>
              <option value="worsted">Worsted</option>
              <option value="bulky">Bulky</option>
            </select>
          </Field>
          <Field label="Kolor próbki">
            <input
              type="color"
              value={draft.hex}
              onChange={(event) => update("hex", event.target.value)}
            />
          </Field>
          <Field label="Waga (g)" error={errors.weight}>
            <input
              type="number"
              min="1"
              value={draft.weight}
              onChange={(event) => update("weight", event.target.value)}
              aria-invalid={Boolean(errors.weight)}
            />
          </Field>
          <Field label="Długość (m)" error={errors.length}>
            <input
              type="number"
              min="1"
              value={draft.length}
              onChange={(event) => update("length", event.target.value)}
              aria-invalid={Boolean(errors.length)}
            />
          </Field>
        </div>

        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>Anuluj</button>
          <button className="button button-primary" type="submit">Zapisz włóczkę</button>
        </div>
      </form>
    </dialog>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}
