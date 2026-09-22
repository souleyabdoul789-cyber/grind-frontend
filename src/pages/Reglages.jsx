import { useState } from "react";
import { GRIND_URL } from "../api.js";

export default function Reglages({ sessionToken, onDeconnexion }) {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  const [notifAide, setNotifAide] = useState(
    localStorage.getItem("grind_pref_notif_aide") !== "0"
  );
  const [notifClasses, setNotifClasses] = useState(
    localStorage.getItem("grind_pref_notif_classes") !== "0"
  );

  function basculerNotifAide() {
    const val = !notifAide;
    setNotifAide(val);
    localStorage.setItem("grind_pref_notif_aide", val ? "1" : "0");
  }

  function basculerNotifClasses() {
    const val = !notifClasses;
    setNotifClasses(val);
    localStorage.setItem("grind_pref_notif_classes", val ? "1" : "0");
  }

  async function gererChangementMdp(e) {
    e.preventDefault();
    setMessage(null);
    setErreur(null);
    setChargement(true);

    try {
      const res = await fetch(`${GRIND_URL}/api/compte/changer-mot-de-passe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          ancien_mot_de_passe: ancien,
          nouveau_mot_de_passe: nouveau,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Impossible de changer le mot de passe");

      setMessage("Mot de passe changé");
      setAncien("");
      setNouveau("");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="fil-actu">
      <div className="carte-post">
        <div className="sous-titre" style={{ marginBottom: 14 }}>
          <i className="fa-solid fa-bell"></i> Notifications
        </div>

        <div className="ligne-reglage">
          <span>Demandes d'aide sur mes matières</span>
          <button
            type="button"
            className={`interrupteur ${notifAide ? "interrupteur-actif" : ""}`}
            onClick={basculerNotifAide}
          >
            <span className="curseur-interrupteur"></span>
          </button>
        </div>

        <div className="ligne-reglage">
          <span>Invitations de classe</span>
          <button
            type="button"
            className={`interrupteur ${notifClasses ? "interrupteur-actif" : ""}`}
            onClick={basculerNotifClasses}
          >
            <span className="curseur-interrupteur"></span>
          </button>
        </div>
      </div>

      <form className="carte-post" onSubmit={gererChangementMdp}>
        <div className="sous-titre" style={{ marginBottom: 4 }}>
          <i className="fa-solid fa-lock"></i> Changer le mot de passe
        </div>

        <label>Mot de passe actuel</label>
        <input type="password" value={ancien} onChange={(e) => setAncien(e.target.value)} required />

        <label>Nouveau mot de passe</label>
        <input type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} required />

        <button type="submit" disabled={chargement}>
          {chargement ? "..." : "Mettre à jour"}
        </button>

        {message && (
          <div className="info" style={{ color: "var(--succes)" }}>
            <i className="fa-solid fa-circle-check"></i> {message}
          </div>
        )}
        {erreur && (
          <div className="erreur">
            <i className="fa-solid fa-triangle-exclamation"></i> {erreur}
          </div>
        )}
      </form>

      <button className="carte-post bouton-danger" onClick={onDeconnexion} type="button">
        <i className="fa-solid fa-right-from-bracket"></i> Se déconnecter
      </button>
    </div>
  );
}
