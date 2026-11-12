import { useState } from "react";

const LIMITE_CARACTERES = 220;

export default function TexteExtensible({ texte, rendreTexte = (valeur) => valeur }) {
  const [etendu, setEtendu] = useState(false);

  if (texte.length <= LIMITE_CARACTERES) {
    return <div className="contenu-post">{rendreTexte(texte)}</div>;
  }

  return (
    <div className="contenu-post">
      {rendreTexte(etendu ? texte : texte.slice(0, LIMITE_CARACTERES).trimEnd() + "...")}
      <button className="lien lien-voir-plus" onClick={() => setEtendu(!etendu)} type="button">
        {etendu ? "Voir moins" : "Voir plus"}
      </button>
    </div>
  );
}
