// code = code ISO 3166-1 alpha-2, utilisé par flag-icons (classe "fi fi-xx")
export const PAYS = [
  { code: "ne", nom: "Niger" },
  { code: "ml", nom: "Mali" },
  { code: "bf", nom: "Burkina Faso" },
  { code: "sn", nom: "Sénégal" },
  { code: "ci", nom: "Côte d'Ivoire" },
  { code: "tg", nom: "Togo" },
  { code: "bj", nom: "Bénin" },
  { code: "gn", nom: "Guinée" },
  { code: "cm", nom: "Cameroun" },
  { code: "td", nom: "Tchad" },
  { code: "cd", nom: "RD Congo" },
  { code: "cg", nom: "Congo" },
  { code: "ga", nom: "Gabon" },
  { code: "ma", nom: "Maroc" },
  { code: "dz", nom: "Algérie" },
  { code: "tn", nom: "Tunisie" },
  { code: "mg", nom: "Madagascar" },
  { code: "fr", nom: "France" },
  { code: "be", nom: "Belgique" },
  { code: "ch", nom: "Suisse" },
  { code: "ca", nom: "Canada" },
];

export function nomPays(code) {
  return PAYS.find((p) => p.code === code)?.nom || code;
}
