import { useState, useEffect, useRef } from "react";
import {
  supportConversation,
  supportOuvrir,
  supportEnvoyer,
  supportDemanderHumain,
  supportCloturer,
} from "../api.js";
import FilSupport from "./FilSupport.jsx";

const DELAI_ACTUALISATION = 5000;

/**
 * ContactSupport — « Contactez-nous ».
 * L'élève décrit son problème ; l'assistant GRIND répond tout de suite ; il peut
 * demander à parler à l'équipe à tout moment. Si l'équipe prend la main, l'assistant
 * se tait et les réponses humaines arrivent ici (la page se met à jour toute seule).
 */
export default function ContactSupport({ sessionToken, onFermer }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const dernierRef = useRef("");

  function appliquer(res) {
    const signature = `${res.conversation?.id}-${res.messages.length}-${res.messages.at(-1)?.id}-${res.conversation?.ia_active}-${res.conversation?.statut}`;
    if (signature === dernierRef.current) return;
    dernierRef.current = signature;
    setConversation(res.conversation);
    setMessages(res.messages);
  }

  // Chargement initial
  useEffect(() => {
    supportConversation(sessionToken)
      .then(appliquer)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  }, [sessionToken]);

  // Mise à jour automatique tant qu'une discussion est ouverte (réponses de l'équipe)
  useEffect(() => {
    if (!conversation || conversation.statut !== "ouvert") return undefined;
    const minuteur = setInterval(() => {
      if (document.visibilityState === "visible" && !envoi) {
        supportConversation(sessionToken).then(appliquer).catch(() => {});
      }
    }, DELAI_ACTUALISATION);
    return () => clearInterval(minuteur);
  }, [conversation, sessionToken, envoi]);

  const ouverte = conversation && conversation.statut === "ouvert";

  async function envoyer() {
    const message = texte.trim();
    if (!message || envoi) return;
    setEnvoi(true);
    setErreur(null);
    setTexte("");
    // Affichage immédiat du message de l'élève, remplacé par la réponse du serveur
    setMessages((liste) => [...liste, { id: `tmp-${Date.now()}`, auteur_type: "utilisateur", contenu: message }]);
    try {
      const res = ouverte
        ? await supportEnvoyer(sessionToken, conversation.id, message)
        : await supportOuvrir(sessionToken, message);
      dernierRef.current = "";
      appliquer(res);
    } catch (err) {
      setErreur(err.message);
      setTexte(message);
      setMessages((liste) => liste.filter((m) => !String(m.id).startsWith("tmp-")));
    } finally {
      setEnvoi(false);
    }
  }

  async function demanderEquipe() {
    setErreur(null);
    try {
      const res = await supportDemanderHumain(sessionToken, conversation.id);
      dernierRef.current = "";
      appliquer(res);
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function terminer() {
    setErreur(null);
    try {
      const res = await supportCloturer(sessionToken, conversation.id);
      dernierRef.current = "";
      appliquer(res);
    } catch (err) {
      setErreur(err.message);
    }
  }

  const assistantRepond = envoi && (!conversation || conversation.ia_active) && !(conversation?.humain_demande && !conversation?.ia_active);

  return (
    <div className="voile-page" onClick={onFermer}>
      <div className="page-support" onClick={(e) => e.stopPropagation()}>
        <div className="entete-page-cgu">
          <div className="sous-titre" style={{ margin: 0 }}>
            <i className="fa-solid fa-headset"></i> Contactez-nous
          </div>
          <button type="button" className="bouton-admin bouton-admin-doux" onClick={onFermer}>
            <i className="fa-solid fa-xmark"></i> Fermer
          </button>
        </div>

        {chargement && <div className="info" style={{ marginTop: 14 }}><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>}

        {!chargement && messages.length === 0 && (
          <div className="info" style={{ margin: "14px 0", fontSize: 13.5, lineHeight: 1.5 }}>
            Décris ton problème ou ta question. L'assistant GRIND te répond tout de suite, et tu peux demander à
            parler à un membre de l'équipe à tout moment.
          </div>
        )}

        {messages.length > 0 && (
          <FilSupport messages={messages} monType="utilisateur" attente={assistantRepond} />
        )}

        {ouverte && conversation.humain_demande && !conversation.ia_active && (
          <div className="info" style={{ fontSize: 13, marginBottom: 8 }}>
            <i className="fa-solid fa-user-clock"></i> L'équipe a la main : sa réponse apparaîtra ici.
          </div>
        )}

        {conversation && !ouverte && (
          <div className="info" style={{ fontSize: 13, marginBottom: 8 }}>
            <i className="fa-solid fa-circle-check"></i> Cette discussion est terminée. Écris un message pour en ouvrir une nouvelle.
          </div>
        )}

        {erreur && <div className="erreur" style={{ marginBottom: 8 }}>{erreur}</div>}

        {!chargement && (
          <>
            <textarea
              className="saisie-support"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  envoyer();
                }
              }}
              rows={3}
              maxLength={1500}
              placeholder={ouverte ? "Ton message..." : "Décris ton problème..."}
            />
            <div className="actions-admin" style={{ marginTop: 10 }}>
              <button type="button" className="bouton-admin" onClick={envoyer} disabled={envoi || !texte.trim()}>
                <i className="fa-solid fa-paper-plane"></i> {envoi ? <span className="grind-spinner" aria-label="Envoi" /> : "Envoyer"}
              </button>
              {ouverte && (
                <>
                  <button
                    type="button"
                    className="bouton-admin bouton-admin-doux"
                    onClick={demanderEquipe}
                    disabled={conversation.humain_demande}
                  >
                    <i className="fa-solid fa-user-shield"></i> {conversation.humain_demande ? "Équipe prévenue" : "Parler à l'équipe"}
                  </button>
                  <button type="button" className="bouton-admin bouton-admin-doux" onClick={terminer}>
                    Terminer
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
