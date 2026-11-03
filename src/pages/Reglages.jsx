import PageCgu from "../components/PageCgu.jsx";
import ContactSupport from "../components/ContactSupport.jsx";
import { useState } from "react";

export default function Reglages({ sessionToken, onDeconnexion }) {
  const [cguOuvertes, setCguOuvertes] = useState(false);
  const [contactOuvert, setContactOuvert] = useState(false);

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

      <button className="carte-post bouton-lien-carte" onClick={() => setContactOuvert(true)} type="button">
        <i className="fa-solid fa-headset"></i> Contactez-nous
      </button>
      {contactOuvert && <ContactSupport sessionToken={sessionToken} onFermer={() => setContactOuvert(false)} />}

      <button className="carte-post bouton-lien-carte" onClick={() => setCguOuvertes(true)} type="button">
        <i className="fa-solid fa-file-contract"></i> Conditions d'utilisation
      </button>
      {cguOuvertes && <PageCgu onFermer={() => setCguOuvertes(false)} />}

      <button className="carte-post bouton-danger" onClick={onDeconnexion} type="button">
        <i className="fa-solid fa-right-from-bracket"></i> Se déconnecter
      </button>
    </div>
  );
}
