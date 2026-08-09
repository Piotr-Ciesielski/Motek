(function exposeMotekLegalDocument(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MotekLegalDocument = api;
  }
})(typeof globalThis === "object" ? globalThis : null, () => {
  const freezeBlock = (block) => Object.freeze({
    ...block,
    ...(Array.isArray(block.items) ? { items: Object.freeze([...block.items]) } : {}),
  });
  const freezeSection = (section) => Object.freeze({
    ...section,
    blocks: Object.freeze(section.blocks.map(freezeBlock)),
  });

  const CURRENT_LEGAL_DOCUMENT = Object.freeze({
    termsVersion: "1.0",
    privacyVersion: "1.0",
    effectiveDate: "2026-08-09",
    revisionDate: "2026-08-09",
    path: "/informacje-prawne",
    copyrightYear: 2026,
    operator: Object.freeze({
      name: "[IMIĘ I NAZWISKO OPERATORA]",
      email: "[E-MAIL KONTAKTOWY]",
    }),
    sections: Object.freeze([
      freezeSection({
        id: "regulamin",
        title: "Regulamin korzystania z Motka",
        blocks: [
          { type: "paragraph", text: "Motek jest bezpłatnym narzędziem o prywatnym charakterze, przeznaczonym do organizowania własnego magazynu włóczek i pracy ze wzorami." },
          { type: "paragraph", text: "Dostęp do konta odbywa się na podstawie zaproszenia. Użytkownik odpowiada za ochronę hasła i nie powinien udostępniać go innym osobom." },
          { type: "list", items: ["Nie używaj Motka do nadużyć, prób obejścia zabezpieczeń ani działań naruszających prawa innych osób.", "Operator może czasowo zablokować konto w razie nadużyć lub zagrożenia bezpieczeństwa.", "Użytkownik może poprosić o usunięcie konta i powiązanych danych."] },
          { type: "notice", text: "Operator nie gwarantuje nieprzerwanej dostępności ani braku błędów usługi." },
        ],
      }),
      freezeSection({
        id: "prywatnosc",
        title: "Prywatność i przetwarzanie danych",
        blocks: [
          { type: "paragraph", text: "Operatorem Motka jest [IMIĘ I NAZWISKO OPERATORA]. Kontakt w sprawach prywatności: [E-MAIL KONTAKTOWY]." },
          { type: "list", items: ["Przetwarzane mogą być e-mail, identyfikator użytkownika, znaczniki czasu, dane magazynu włóczek, informacje o sesji oraz logi techniczne.", "Dane służą do obsługi konta, działania i zabezpieczenia Motka, diagnostyki oraz komunikacji związanej z usługą.", "Użytkownik może korzystać z praw wynikających z przepisów, w tym żądać dostępu, sprostowania, usunięcia lub ograniczenia przetwarzania, gdy mają zastosowanie."] },
          { type: "notice", text: "Ten dokument przekazuje informacje o przetwarzaniu danych i nie stanowi zgody na całe przetwarzanie danych." },
        ],
      }),
      freezeSection({
        id: "prawa-autorskie",
        title: "Prawa autorskie i katalog wzorów",
        blocks: [
          { type: "paragraph", text: "Kod, interfejs i marka Motek podlegają ochronie. Udostępnienie Motka nie oznacza przeniesienia praw do tych elementów." },
          { type: "paragraph", text: "Komponenty zewnętrzne są używane na podstawie właściwych licencji, których warunki pozostają wiążące." },
          { type: "list", items: ["Prawa do wzorów należą do ich autorów lub innych uprawnionych osób.", "Nie importuj do Motka treści PDF ani innych materiałów, do których nie masz odpowiednich praw."] },
        ],
      }),
    ]),
  });

  function assertText(value, label) {
    if (typeof value !== "string" || !value.trim() || /<[^>]+>/.test(value)) {
      throw new TypeError(`${label} musi być niepustym tekstem bez HTML.`);
    }
  }

  function assertDate(value, label) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new TypeError(`${label} ma nieprawidłowy format.`);
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new TypeError(`${label} ma nieprawidłową wartość.`);
    }
  }

  function assertLegalDocumentShape(document) {
    if (!document || typeof document !== "object") throw new TypeError("Dokument ma nieprawidłowy kształt.");
    for (const field of ["termsVersion", "privacyVersion"]) {
      if (typeof document[field] !== "string" || !/^\d+\.\d+$/.test(document[field])) {
        throw new TypeError(`Nieprawidłowa wersja: ${field}.`);
      }
    }
    assertDate(document.effectiveDate, "Data wejścia w życie");
    assertDate(document.revisionDate, "Data rewizji");
    if (document.path !== "/informacje-prawne") {
      throw new TypeError("Ścieżka dokumentu jest nieprawidłowa.");
    }
    if (!Number.isInteger(document.copyrightYear) || document.copyrightYear < 1900 || document.copyrightYear > 9999) {
      throw new TypeError("Rok copyright jest nieprawidłowy.");
    }
    if (!document.operator || typeof document.operator !== "object") {
      throw new TypeError("Operator jest nieprawidłowy.");
    }
    assertText(document.operator.name, "Nazwa operatora");
    assertText(document.operator.email, "E-mail operatora");
    if (document.operator.email !== "[E-MAIL KONTAKTOWY]" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.operator.email)) {
      throw new TypeError("E-mail operatora ma nieprawidłowy format.");
    }
    if (!Array.isArray(document.sections) || document.sections.length !== 3) {
      throw new TypeError("Dokument musi mieć trzy sekcje.");
    }
    const requiredSectionIds = ["regulamin", "prywatnosc", "prawa-autorskie"];
    const ids = new Set();
    for (const [index, section] of document.sections.entries()) {
      assertText(section?.id, "Id sekcji");
      if (section.id !== requiredSectionIds[index]) {
        throw new TypeError("Sekcje dokumentu mają nieprawidłowe identyfikatory lub kolejność.");
      }
      if (ids.has(section.id)) throw new TypeError("Id sekcji muszą być unikalne.");
      ids.add(section.id);
      assertText(section.title, "Tytuł sekcji");
      if (!Array.isArray(section.blocks)) throw new TypeError("Bloki sekcji muszą być tablicą.");
      for (const block of section.blocks) {
        if (!block || !["paragraph", "list", "notice"].includes(block.type)) {
          throw new TypeError("Blok ma nieznany typ.");
        }
        if (block.type === "list") {
          if (!Array.isArray(block.items) || !block.items.length) throw new TypeError("Lista bloku jest nieprawidłowa.");
          block.items.forEach((item) => assertText(item, "Element listy"));
        } else {
          assertText(block.text, "Tekst bloku");
        }
      }
    }
    return true;
  }

  function formatCopyrightNotice(document) {
    return `© ${document.copyrightYear} Motek — ${document.operator.name}. Wszelkie prawa zastrzeżone.`;
  }

  return { CURRENT_LEGAL_DOCUMENT, assertLegalDocumentShape, formatCopyrightNotice };
});
