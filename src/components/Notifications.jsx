import { useState, useEffect, useRef } from "react";
import { urlNotifs, listerAnnonces } from "../api.js";
import ModaleAnnonce from "./ModaleAnnonce.jsx";

const CLE_ANNONCE_VUE = "grind_annonce_vue"; // plus grand numéro d'annonce déjà vu

function dernierNumeroVu() {
  return Number(localStorage.getItem(CLE_ANNONCE_VUE) || 0);
}

function memoriserNumero(numero) {
  if (numero > dernierNumeroVu()) localStorage.setItem(CLE_ANNONCE_VUE, String(numero));
}

export default function Notifications({ sessionToken }) {
  const [ouvert, setOuvert] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [annonceOuverte, setAnnonceOuverte] = useState(null);
  const socketRef = useRef(null);

  // Notifications en direct (WebSocket)
  useEffect(() => {
    const socket = new WebSocket(urlNotifs(sessionToken));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // L'annonce arrive avec son numéro dans `id` : on le range dans `numero`
      // avant de donner à la notification son identifiant local.
      const base = data.type === "annonce" ? { ...data, numero: data.id } : data;
      setNotifs((prev) => [{ ...base, id: crypto.randomUUID(), lu: false }, ...prev].slice(0, 30));
    };

    socket.onerror = () => {
      // La connexion retentera au prochain montage — pas de blocage de l'UI pour ça
    };

    return () => socket.close();
  }, [sessionToken]);

  // Rattrapage : les annonces publiées pendant qu'on n'était pas connecté.
  useEffect(() => {
    let actif = true;
    listerAnnonces(sessionToken)
      .then((res) => {
        if (!actif) return;
        const plusGrand = res.annonces.reduce((m, a) => Math.max(m, a.id), 0);
        // Premier lancement sur cet appareil : on ne réveille pas les vieilles annonces.
        if (localStorage.getItem(CLE_ANNONCE_VUE) === null) {
          memoriserNumero(plusGrand);
          return;
        }
        const vu = dernierNumeroVu();
        const nouvelles = res.annonces
          .filter((a) => a.id > vu)
          .map((a) => ({ ...a, type: "annonce", id: `annonce-${a.id}`, numero: a.id, lu: false }));
        if (nouvelles.length > 0) setNotifs((prev) => [...nouvelles, ...prev].slice(0, 30));
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [sessionToken]);

  const nonLues = notifs.filter((n) => !n.lu).length;

  function ouvrirPanneau() {
    setOuvert(!ouvert);
    if (!ouvert) {
      setNotifs((prev) => prev.map((n) => ({ ...n, lu: true })));
    }
  }

  function ouvrirAnnonce(n) {
    memoriserNumero(n.numero || 0);
    setAnnonceOuverte(n);
    setOuvert(false);
  }

  function texteNotif(n) {
    if (n.type === "nouvelle_demande") return `${n.demandeur} a besoin d'aide en ${n.sujet}`;
    if (n.type === "participant_rejoint") return `${n.username} a rejoint ta demande d'aide`;
    if (n.type === "nouveau_membre_classe") return `${n.nouveau_membre} a rejoint ta classe "${n.nom_classe}"`;
    return "Nouvelle activité";
  }

  return (
    <div className="notifs-conteneur">
      <button className="bouton-cloche" onClick={ouvrirPanneau} type="button">
        <i className="fa-solid fa-bell"></i>
        {nonLues > 0 && <span className="badge-notif">{nonLues}</span>}
      </button>

      {ouvert && (
        <div className="panneau-notifs">
          {notifs.length === 0 ? (
            <div className="notif-vide">
              <i className="fa-regular fa-bell-slash"></i>
              Rien pour l'instant
            </div>
          ) : (
            notifs.map((n) =>
              n.type === "annonce" ? (
                <button key={n.id} type="button" className="ligne-notif ligne-notif-annonce" onClick={() => ouvrirAnnonce(n)}>
                  <i className="fa-solid fa-bullhorn"></i>
                  Annonce : {n.titre}
                </button>
              ) : (
                <div key={n.id} className="ligne-notif">
                  <i className="fa-solid fa-circle-notch"></i>
                  {texteNotif(n)}
                </div>
              )
            )
          )}
        </div>
      )}

      {annonceOuverte && <ModaleAnnonce annonce={annonceOuverte} onFermer={() => setAnnonceOuverte(null)} />}
    </div>
  );
}
