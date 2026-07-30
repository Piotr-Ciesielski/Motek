export const VARIANTS = [
  {
    id: "atelier",
    number: 1,
    name: "Atelier",
    layout: "editorial",
    asset: "/assets/atelier-yarn-cat.png",
    eyebrow: "Twoja prywatna pracownia",
    note: "Piękne materiały zasługują na spokojną oprawę.",
  },
  {
    id: "nordic",
    number: 2,
    name: "Nordic",
    layout: "grid",
    asset: "/assets/nordic-yarn-cat.png",
    eyebrow: "Porządek, który inspiruje",
    note: "Wszystko, czego potrzebujesz — dokładnie na swoim miejscu.",
  },
  {
    id: "forest",
    number: 3,
    name: "Leśna Pracownia",
    layout: "sidebar",
    asset: "/assets/forest-yarn-cat.png",
    eyebrow: "Z natury do Twoich rąk",
    note: "Każdy motek ma swoją historię. Ty tworzysz kolejną.",
  },
  {
    id: "color",
    number: 4,
    name: "Koloroterapia",
    layout: "asymmetric",
    asset: "/assets/color-yarn-cat.png",
    eyebrow: "Twoja kreatywna paleta",
    note: "Kolory gotowe na następny śmiały pomysł.",
  },
  {
    id: "night",
    number: 5,
    name: "Nocny Motek",
    layout: "dark",
    asset: "/assets/night-yarn-cat.png",
    eyebrow: "Wieczorna pracownia",
    note: "Najlepsze pomysły często przychodzą po zmroku.",
  },
];

export function getVariant(id) {
  return VARIANTS.find((variant) => variant.id === id) ?? VARIANTS[0];
}
