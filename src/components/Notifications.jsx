import { useState, useEffect, useRef } from "react";
import { urlNotifs, listerAnnonces, listerNotifications, marquerNotificationLue } from "../api.js";
import ModaleAnnonce from "./ModaleAnnonce.jsx";

const CLE_ANNONCE_VUE = "grind_annonce_vue"; // plus grand numéro d'annonce déjà vu
const CLE_ANNONCES_MASQUEES = "grind_annonces_masquees";

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
  const idsMasques = useRef(new Set());

  useEffect(() => {
    const actualiserMasquees = () => {
      try { idsMasques.current = new Set(JSON.parse(localStorage.getItem(CLE_ANNONCES_MASQUEES) || "[]").map(Number)); }
      catch { idsMasques.current = new Set(); }
      setNotifs((prev) => prev.filter((n) => n.type !== "annonce" || n.important || !idsMasques.current.has(Number(n.numero || n.id))));
    };
    actualiserMasquees();
    window.addEventListener("grind-annonces-masquees", actualiserMasquees);
    return () => window.removeEventListener("grind-annonces-masquees", actualiserMasquees);
  }, []);

  // Notifications persistantes de mentions : rattrapage à l'ouverture et actualisation périodique.
  useEffect(() => {
    let actif = true;
    const chargerMentions = async () => {
      try {
        const res = await listerNotifications(sessionToken);
        if (!actif) return;
        const mentions = (res.notifications || []).map(n => ({ ...n, id: `mention-${n.id}`, notificationId: n.id, type: "mention" }));
        setNotifs(prev => {
          const autres = prev.filter(n => n.type !== "mention");
          const deja = new Set(autres.map(n => n.id));
          return [...mentions.filter(n => !deja.has(n.id)), ...autres].slice(0, 50);
        });
      } catch {}
    };
    chargerMentions();
    const timer = window.setInterval(chargerMentions, 30000);
    return () => { actif = false; window.clearInterval(timer); };
  }, [sessionToken]);

  // Notifications en direct (WebSocket)
  useEffect(() => {
    const socket = new WebSocket(urlNotifs(sessionToken));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // L'annonce arrive avec son numéro dans `id` : on le range dans `numero`
      // avant de donner à la notification son identifiant local.
      const base = data.type === "annonce" ? { ...data, numero: data.id } : data;
      if (data.type !== "annonce" || data.important || !idsMasques.current.has(Number(data.id))) {
        setNotifs((prev) => {
          if (data.type === "annonce" && prev.some((n) => n.type === "annonce" && Number(n.numero || n.id) === Number(data.id))) return prev;
          return [{ ...base, id: crypto.randomUUID(), lu: false }, ...prev].slice(0, 30);
        });
      }
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
        const premiereVisite = localStorage.getItem(CLE_ANNONCE_VUE) === null;
        if (premiereVisite) memoriserNumero(plusGrand);
        const vu = premiereVisite ? plusGrand : dernierNumeroVu();
        const nouvelles = res.annonces
          .filter((a) => (a.important || a.id > vu) && (a.important || !idsMasques.current.has(Number(a.id))))
          .map((a) => ({ ...a, type: "annonce", id: `annonce-${a.id}`, numero: a.id, lu: false }));
        if (nouvelles.length > 0) {
          setNotifs((prev) => {
            const presentes = new Set(prev.filter((n) => n.type === "annonce").map((n) => Number(n.numero || n.id)));
            return [...nouvelles.filter((n) => !presentes.has(Number(n.numero))), ...prev].slice(0, 30);
          });
        }
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
    memoriserNumero(n.numero || n.id || 0);
    setAnnonceOuverte(n);
    setOuvert(false);
  }

  function masquerAnnonce(id) {
    // Une annonce signalée comme importante reste visible et ne peut pas être masquée localement.
    if (annonceOuverte?.important) return;
    const nouveaux = new Set(idsMasques.current); nouveaux.add(Number(id));
    idsMasques.current = nouveaux;
    localStorage.setItem(CLE_ANNONCES_MASQUEES, JSON.stringify([...nouveaux]));
    setNotifs((prev) => prev.filter((n) => Number(n.numero || n.id) !== Number(id)));
    setAnnonceOuverte(null);
  }

  function texteNotif(n) {
    if (n.type === "mention") return `@${n.acteur} t’a mentionné dans une publication`;
    if (n.type === "nouvelle_demande") return `${n.demandeur} a besoin d'aide en ${n.sujet}`;
    if (n.type === "participant_rejoint") return `${n.username} a rejoint ta demande d'aide`;
    if (n.type === "nouveau_membre_classe") return `${n.nouveau_membre} a rejoint ta classe "${n.nom_classe}"`;
    if (n.type === "support_reponse") return "L'équipe a répondu à ta demande (Réglages › Contactez-nous)";
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
              n.type === "mention" ? (
                <button key={n.id} type="button" className="ligne-notif" onClick={async () => {
                  if (!n.lu) marquerNotificationLue(sessionToken, n.notificationId).catch(() => {});
                  setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, lu: true } : x));
                  setOuvert(false);
                  window.dispatchEvent(new CustomEvent("grind-open-post", { detail: n.post_id }));
                }}>
                  <i className="fa-solid fa-at"></i><span>{texteNotif(n)}<small>{n.extrait || "Ouvrir la publication"}</small></span>
                </button>
              ) : n.type === "annonce" ? (
                <button key={n.id} type="button" className={`ligne-notif ligne-notif-annonce ${n.important ? "ligne-notif-importante" : ""}`} onClick={() => ouvrirAnnonce(n)}>
                  <i className="fa-solid fa-bullhorn"></i>
                  <span>Annonce : {n.titre}{n.important ? <small> · IMPORTANT</small> : null}</span>
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

      {annonceOuverte && <ModaleAnnonce annonce={annonceOuverte} onFermer={() => setAnnonceOuverte(null)} onMasquer={masquerAnnonce} />}
    </div>
  );
}
