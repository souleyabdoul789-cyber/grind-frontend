import { useState, useEffect } from "react";
import { obtenirCatalogueAvatar, obtenirMonAvatar, enregistrerAvatar } from "../api.js";
import AvatarPersonnage from "../components/AvatarPersonnage.jsx";

const CATEGORIES = [
  { cle: "genre", label: "Genre", icone: "fa-solid fa-venus-mars" },
  { cle: "cheveux", label: "Cheveux", icone: "fa-solid fa-scissors" },
  { cle: "vetement", label: "Tenue", icone: "fa-solid fa-shirt" },
  { cle: "chaussures", label: "Chaussures", icone: "fa-solid fa-shoe-prints" },
  { cle: "gants", label: "Gants", icone: "fa-solid fa-hand" },
  { cle: "chapeau", label: "Chapeau", icone: "fa-solid fa-hat-cowboy" },
  { cle: "lunettes", label: "Lunettes", icone: "fa-solid fa-glasses" },
  { cle: "couleur_aura", label: "Aura", icone: "fa-solid fa-sparkles" },
];

export default function Personnalisation({ sessionToken, onRetour }) {
  const [catalogue, setCatalogue] = useState([]);
  const [itemsDebloques, setItemsDebloques] = useState([]);
  const [config, setConfig] = useState(null);
  const [categorieActive, setCategorieActive] = useState("genre");
  const [chargement, setChargement] = useState(true);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [demoParle, setDemoParle] = useState(false);

  useEffect(() => {
    async function charger() {
      const [cat, moi] = await Promise.all([obtenirCatalogueAvatar(), obtenirMonAvatar(sessionToken)]);
      setCatalogue(cat.catalogue || []);
      setItemsDebloques(moi.items_debloques || []);
      setConfig(moi.config);
      setChargement(false);
    }
    charger();
  }, [sessionToken]);

  function choisir(categorie, itemId) {
    setConfig((prev) => ({ ...prev, [categorie]: itemId }));
  }

  function retirerOptionnel(categorie) {
    setConfig((prev) => ({ ...prev, [categorie]: null }));
  }

  async function sauvegarder() {
    setErreur(null);
    setEnregistrementEnCours(true);
    try {
      await enregistrerAvatar(sessionToken, config);
      onRetour();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  if (chargement || !config) {
    return <div className="fil-actu"><div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div></div>;
  }

  const itemsCategorie = catalogue.filter((i) => i.categorie === categorieActive);
  const estOptionnelle = ["chapeau", "lunettes", "gants"].includes(categorieActive);

  return (
    <div className="fil-actu">
      <div className="apercu-avatar" onClick={() => setDemoParle((v) => !v)} style={{ cursor: "pointer" }}>
        <AvatarPersonnage config={config} parle={demoParle} taille={160} />
      </div>
      <div className="info" style={{ justifyContent: "center", marginBottom: 16 }}>
        <i className="fa-solid fa-hand-pointer"></i> Touche l'avatar pour prévisualiser l'aura qui parle
      </div>

      <div className="onglets-categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.cle}
            className={categorieActive === c.cle ? "onglet-feuille onglet-feuille-actif" : "onglet-feuille"}
            onClick={() => setCategorieActive(c.cle)}
            type="button"
          >
            <i className={c.icone}></i> {c.label}
          </button>
        ))}
      </div>

      {estOptionnelle && config[categorieActive] && (
        <button className="action-post" style={{ marginBottom: 10 }} onClick={() => retirerOptionnel(categorieActive)} type="button">
          <i className="fa-solid fa-ban"></i> Retirer
        </button>
      )}

      <div className="grille-items">
        {itemsCategorie.map((item) => {
          const debloque = itemsDebloques.includes(item.id);
          const actif = config[categorieActive] === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`carte-item-avatar ${actif ? "carte-item-avatar-actif" : ""} ${!debloque ? "carte-item-avatar-verrouille" : ""}`}
              onClick={() => debloque && choisir(categorieActive, item.id)}
              disabled={!debloque}
            >
              {!debloque && <i className="fa-solid fa-lock icone-cadenas"></i>}
              <i className={CATEGORIES.find((c) => c.cle === categorieActive)?.icone}></i>
              <span>{item.nom}</span>
              {!debloque && (
                <span className="badge-prix-g">
                  <i className="fa-solid fa-coins"></i> {item.prix_g.toLocaleString("fr-FR")} G
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rangee-boutons" style={{ marginTop: 20 }}>
        <button type="button" className="bouton-retour" onClick={onRetour}>Annuler</button>
        <button type="button" onClick={sauvegarder} disabled={enregistrementEnCours}>
          {enregistrementEnCours ? "..." : "Enregistrer"}
        </button>
      </div>

      {erreur && <div className="erreur"><i className="fa-solid fa-triangle-exclamation"></i>{erreur}</div>}
    </div>
  );
}
