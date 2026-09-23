import { useState, useEffect, useRef } from "react";
import { urlNotifs } from "../api.js";

export default function Notifications({ sessionToken }) {
  const [ouvert, setOuvert] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket(urlNotifs(sessionToken));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setNotifs((prev) => [{ ...data, id: crypto.randomUUID(), lu: false }, ...prev].slice(0, 30));
    };

    socket.onerror = () => {
      // La connexion retentera au prochain montage — pas de blocage de l'UI pour ça
    };

    return () => socket.close();
  }, [sessionToken]);

  const nonLues = notifs.filter((n) => !n.lu).length;

  function ouvrirPanneau() {
    setOuvert(!ouvert);
    if (!ouvert) {
      setNotifs((prev) => prev.map((n) => ({ ...n, lu: true })));
    }
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
            notifs.map((n) => (
              <div key={n.id} className="ligne-notif">
                <i className="fa-solid fa-circle-notch"></i>
                {texteNotif(n)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
