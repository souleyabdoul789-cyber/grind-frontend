import { useState, useEffect, useRef } from "react";
import { urlNotifs, listerAnnonces, listerNotifications, marquerNotificationLue, enregistrerJetonPush, retirerJetonPush } from "../api.js";
import ModaleAnnonce from "./ModaleAnnonce.jsx";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

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

  async function ouvrirCiblePush(data = {}) {
    const type = data.event_type || "";
    if (data.resource_type === "library_document" && data.resource_id) {
      window.dispatchEvent(new CustomEvent("grind-open-library-doc", { detail: Number(data.resource_id) }));
    } else if (data.resource_type === "classe_discussion_message" && data.classe_id) {
      window.dispatchEvent(new CustomEvent("grind-open-discussion", { detail: { classe_id: Number(data.classe_id), message_id: Number(data.resource_id || 0) } }));
    } else if (data.post_id) {
      window.dispatchEvent(new CustomEvent("grind-navigate-post", { detail: { post_id: Number(data.post_id), commentaire_id: data.commentaire_id ? Number(data.commentaire_id) : null } }));
    } else if (type === "annonce" && data.annonce_id) {
      try {
        const res = await listerAnnonces(sessionToken);
        const annonce = (res.annonces || []).find(a => Number(a.id) === Number(data.annonce_id));
        if (annonce) setAnnonceOuverte({ ...annonce, type: "annonce", id: `annonce-${annonce.id}`, numero: annonce.id });
      } catch {}
    } else if (type === "nouveau_membre_classe" && data.classe_id) {
      window.dispatchEvent(new CustomEvent("grind-open-class", { detail: { classe_id: Number(data.classe_id) } }));
    } else if (type === "support_reponse") {
      window.dispatchEvent(new CustomEvent("grind-open-support", { detail: { conversation_id: Number(data.conversation_id || 0) } }));
    } else if ((type === "nouvelle_demande" || type === "participant_rejoint") && data.demande_id) {
      window.dispatchEvent(new CustomEvent("grind-open-help-request", { detail: { demande_id: Number(data.demande_id) } }));
    }
  }

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

  // Notifications Android natives (FCM). Le site web garde son système actuel.
  useEffect(() => {
    if (!sessionToken || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    let actif = true;
    let jeton = localStorage.getItem("grind_push_token") || "";
    const ecouteurs = [];

    const initialiser = async () => {
      try {
        ecouteurs.push(await PushNotifications.addListener("registration", async ({ value }) => {
          if (!actif || !value) return;
          jeton = value;
          localStorage.setItem("grind_push_token", value);
          try { await enregistrerJetonPush(sessionToken, value); } catch {}
        }));
        ecouteurs.push(await PushNotifications.addListener("registrationError", (error) => {
          console.warn("Enregistrement des notifications GRIND impossible", error);
        }));
        ecouteurs.push(await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
          if (!actif) return;
          setNotifs(prev => [{
            id: `push-${Date.now()}`, type: "push", title: notification?.title || "GRIND",
            body: notification?.body || "Nouvelle activité", data: notification?.data || {}, lu: false,
          }, ...prev].slice(0, 50));
          try {
            const res = await listerNotifications(sessionToken);
            if (!actif) return;
            const persistantes = (res.notifications || []).map(n => ({ ...n, id: `persist-${n.id}`, notificationId: n.id, eventType: n.type, type: "persistante" }));
            setNotifs(prev => [...persistantes, ...prev.filter(n => n.type !== "persistante")].slice(0, 50));
          } catch {}
        }));
        ecouteurs.push(await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
          if (!actif) return;
          ouvrirCiblePush(notification?.data || {});
        }));

        const permissions = await PushNotifications.checkPermissions();
        let reception = permissions.receive;
        if (reception === "prompt") reception = (await PushNotifications.requestPermissions()).receive;
        if (!actif || reception !== "granted") return;
        await PushNotifications.createChannel({ id: "grind-notifications", name: "GRIND", description: "Notifications de ton activité GRIND", importance: 5, visibility: 1 });
        await PushNotifications.register();
      } catch (error) {
        console.warn("Notifications Android GRIND indisponibles", error);
      }
    };

    initialiser();
    return () => {
      actif = false;
      for (const ecouteur of ecouteurs) ecouteur.remove().catch(() => {});
      if (jeton) {
        retirerJetonPush(sessionToken, jeton).catch(() => {});
        if (localStorage.getItem("grind_push_token") === jeton) localStorage.removeItem("grind_push_token");
      }
    };
  }, [sessionToken]);

  // Notifications persistantes de mentions : rattrapage à l'ouverture et actualisation périodique.
  useEffect(() => {
    let actif = true;
    const chargerMentions = async () => {
      try {
        const res = await listerNotifications(sessionToken);
        if (!actif) return;
        const persistantes = (res.notifications || []).map(n => ({ ...n, id: `persist-${n.id}`, notificationId: n.id, eventType: n.type, type: "persistante" }));
        setNotifs(prev => {
          const autres = prev.filter(n => n.type !== "persistante");
          const deja = new Set(autres.map(n => n.id));
          return [...persistantes.filter(n => !deja.has(n.id)), ...autres].slice(0, 50);
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
    if (n.type === "push") return n.title || n.body || "Nouvelle activité GRIND";
    if (n.type === "persistante") {
      const nom = n.acteur_nom || n.acteur;
      if (n.eventType === "mention") return `${nom} t’a mentionné`;
      if (n.eventType === "mention_classe") return `${nom} t’a mentionné dans une discussion de classe`;
      if (n.eventType === "message_classe") return `${nom} a envoyé un message dans une discussion de classe`;
      if (n.eventType === "like_publication") return `${nom} a aimé ta publication`;
      if (n.eventType === "commentaire") return `${nom} a commenté ta publication`;
      if (n.eventType === "reponse_commentaire") return `${nom} a répondu à ton commentaire`;
      if (n.eventType === "like_commentaire") return `${nom} a aimé ton commentaire`;
      if (n.eventType === "avis_doc") return `${nom} a évalué un document de ta Library`;
      if (n.eventType === "commentaire_doc") return `${nom} a donné son avis sur un document de ta Library`;
      return `${nom} a interagi avec ton contenu`;
    }
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
              n.type === "persistante" ? (
                <button key={n.id} type="button" className={`ligne-notif ${n.lu ? "" : "notification-non-lue"}`} onClick={async () => {
                  if (!n.lu) marquerNotificationLue(sessionToken, n.notificationId).catch(() => {});
                  setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, lu: true } : x));
                  setOuvert(false);
                  if (n.resource_type === "library_document") window.dispatchEvent(new CustomEvent("grind-open-library-doc", { detail: n.resource_id }));
                  else if (n.resource_type === "classe_discussion_message" && n.classe_id) window.dispatchEvent(new CustomEvent("grind-open-discussion", { detail: { classe_id: n.classe_id, message_id: n.resource_id } }));
                  else if (n.post_id) window.dispatchEvent(new CustomEvent("grind-navigate-post", { detail: { post_id: n.post_id, commentaire_id: n.commentaire_id || null } }));
                }}>
                  <i className={n.eventType === "mention" || n.eventType === "mention_classe" ? "fa-solid fa-at" : n.eventType?.includes("like") || n.eventType === "avis_doc" ? "fa-solid fa-heart" : "fa-solid fa-comment"}></i><span>{texteNotif(n)}<small>{n.extrait || "Ouvrir le contenu"}</small></span>
                </button>
              ) : n.type === "push" ? (
                <button key={n.id} type="button" className="ligne-notif" onClick={() => { setOuvert(false); ouvrirCiblePush(n.data || {}); }}>
                  <i className="fa-solid fa-bell"></i>
                  <span>{texteNotif(n)}<small>{n.body || "Ouvrir GRIND"}</small></span>
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
