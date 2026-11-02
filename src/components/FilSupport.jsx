import { useEffect, useRef } from "react";
import { formaterDate } from "../moderationInfos.js";

function Auteur({ message, vueEquipe }) {
  if (message.auteur_type === "ia") {
    return <span className="bulle-auteur"><i className="fa-solid fa-robot"></i> Assistant GRIND</span>;
  }
  if (message.auteur_type === "equipe") {
    return (
      <span className="bulle-auteur">
        <i className="fa-solid fa-shield-halved"></i> Équipe GRIND{vueEquipe && message.auteur ? ` · ${message.auteur}` : ""}
      </span>
    );
  }
  return vueEquipe ? <span className="bulle-auteur"><i className="fa-solid fa-user"></i> {message.auteur}</span> : null;
}

/**
 * FilSupport — la conversation, en bulles.
 * monType : "utilisateur" (vue de l'élève) ou "equipe" (vue de l'équipe) — c'est le
 * côté « moi », affiché à droite.
 * attente : affiche « l'assistant écrit… » pendant qu'une réponse est en route.
 */
export default function FilSupport({ messages, monType = "utilisateur", vueEquipe = false, attente = false }) {
  const refConteneur = useRef(null);

  useEffect(() => {
    const el = refConteneur.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, attente]);

  return (
    <div className="fil-support" ref={refConteneur}>
      {messages.map((m) =>
        m.auteur_type === "systeme" ? (
          <div key={m.id} className="bulle-systeme">{m.contenu}</div>
        ) : (
          <div key={m.id} className={`bulle bulle-${m.auteur_type} ${m.auteur_type === monType ? "bulle-moi" : ""}`}>
            <Auteur message={m} vueEquipe={vueEquipe} />
            <div className="bulle-texte">{m.contenu}</div>
            {m.created_at && <div className="bulle-heure">{formaterDate(m.created_at)}</div>}
          </div>
        )
      )}
      {attente && (
        <div className="bulle bulle-ia bulle-attente">
          <span className="bulle-auteur"><i className="fa-solid fa-robot"></i> Assistant GRIND</span>
          <div className="bulle-texte"><i className="fa-solid fa-ellipsis fa-fade"></i></div>
        </div>
      )}
    </div>
  );
}
