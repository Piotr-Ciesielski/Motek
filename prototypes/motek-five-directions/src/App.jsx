import { useEffect, useMemo, useReducer } from "react";
import { AppShell } from "./components/AppShell.jsx";
import { CatalogView } from "./components/CatalogView.jsx";
import { InventoryView } from "./components/InventoryView.jsx";
import { MatchingView } from "./components/MatchingView.jsx";
import { YarnDialog } from "./components/YarnDialog.jsx";
import { createInitialState, prototypeReducer } from "./model/prototype-state.mjs";
import { getVariant } from "./variants/variants.mjs";

export function App() {
  const variantId = new URLSearchParams(window.location.search).get("variant") || "atelier";
  const variant = getVariant(variantId);
  const [state, dispatch] = useReducer(prototypeReducer, variant.id, createInitialState);

  useEffect(() => {
    document.title = `${variant.number} — ${variant.name} — Motek`;
  }, [variant]);

  const editedYarn = useMemo(
    () => state.inventory.find((yarn) => yarn.id === state.dialog.yarnId) ?? null,
    [state.dialog.yarnId, state.inventory],
  );

  return (
    <AppShell
      variant={variant}
      screen={state.screen}
      onNavigate={(screen) => dispatch({ type: "NAVIGATE", screen })}
    >
      {state.screen === "inventory" ? (
        <InventoryView variant={variant} inventory={state.inventory} dispatch={dispatch} />
      ) : null}
      {state.screen === "matching" ? (
        <MatchingView inventory={state.inventory} dispatch={dispatch} />
      ) : null}
      {state.screen === "catalog" ? (
        <CatalogView state={state} dispatch={dispatch} />
      ) : null}
      <YarnDialog
        open={state.dialog.open}
        yarn={editedYarn}
        onClose={() => dispatch({ type: "CLOSE_YARN_DIALOG" })}
        onSave={(draft) => dispatch({ type: "SAVE_YARN", draft })}
      />
    </AppShell>
  );
}
