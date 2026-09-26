import MascotteGrind from "./MascotteGrind.jsx";

export default function EtatVide({ texte, humeur = "vide" }) {
  return (
    <div className="etat-vide">
      <MascotteGrind humeur={humeur} taille={72} />
      <div className="texte-etat-vide">{texte}</div>
    </div>
  );
}
