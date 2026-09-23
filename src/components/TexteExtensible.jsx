import { useState } from "react";

const LIMITE_CARACTERES = 220;

export default function TexteExtensible({ texte }) {
  const [etendu, setEtendu] = useState(false);

  if (texte.length <= LIMITE_CARACTERES) {
    return <div className="contenu-post">{texte}</div>;
  }

  return (
    <div className="contenu-post">
      {etendu ? texte : texte.slice(0, LIMITE_CARACTERES).trimEnd() + "..."}
      <button className="lien lien-voir-plus" onClick={() => setEtendu(!etendu)} type="button">
        {etendu ? "Voir moins" : "Voir plus"}
      </button>
    </div>
  );
}
