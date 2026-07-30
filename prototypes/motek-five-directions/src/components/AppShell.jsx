import {
  BookOpen,
  Boxes,
  CircleUserRound,
  Sparkles,
} from "lucide-react";

const navigation = [
  { id: "inventory", label: "Magazyn", icon: Boxes },
  { id: "matching", label: "Dopasowanie", icon: Sparkles },
  { id: "catalog", label: "Katalog", icon: BookOpen },
];

export function AppShell({ variant, screen, onNavigate, children }) {
  return (
    <div className={`app theme-${variant.id} layout-${variant.layout}`}>
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => onNavigate("inventory")}
          aria-label="Przejdź do magazynu"
        >
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>Motek</span>
        </button>

        <nav className="desktop-nav" aria-label="Główna nawigacja">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className="nav-button"
              aria-current={screen === id ? "page" : undefined}
              onClick={() => onNavigate(id)}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <button className="account-button" type="button" aria-label="Konto demonstracyjne">
          <CircleUserRound size={20} aria-hidden="true" />
          <span>Konto</span>
        </button>

        <p className="variant-note">{variant.note}</p>
      </header>

      <main className="app-body" id="main-content">{children}</main>

      <nav className="mobile-nav" aria-label="Mobilna nawigacja">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-current={screen === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
