import { useState, useEffect, useCallback, useRef } from "react";
import {
  adminSupportListe,
  adminSupportLire,
  adminSupportRepondre,
  adminSupportIA,
  adminSupportCloturer,
  adminSupportAssistant,
} from "../api.js";
import FilSupport from "../components/FilSupport.jsx";
import BadgeCompte from "../components/BadgeCompte.jsx";
import { formaterDate } from "../moderationInfos.js";

const DELAI_LISTE = 8000;
const DELAI_DETAIL = 5000;

function Interrupteur({ actif, onBasculer }) {
  return (
    <button type="button" className={`interrupteur ${actif ? "interrupteur-actif" : ""}`} onClick={onBasculer}>
      <span className="curseur-interrupteur"></span>
    </button>
  );
}

/* --------------------- État de l'assistant IA (pour l'équipe) --------------------- */
function EtatAssistant({ sessionToken }) {
  const [etat, setEtat] = useState(null);
  const [essai, setEssai] = useState(false);

  useEffect(() => {
    adminSupportAssistant(sessionToken, false).then(setEtat).catch(() => {});
  }, [sessionToken]);

  async function tester() {
    setEssai(true);
    try {
      setEtat(await adminSupportAssistant(sessionToken, true));
    } catch (err) {
      setEtat({ ok: false, detail: err.message, modele: null, cle_presente: false });
    } finally {
      setEssai(false);
    }
  }

  const jamaisEssaye = etat && etat.ok === null;
  return (
    <div className="panneau-sanction" style={{ marginBottom: 14 }}>
      <div className="ligne-reglage" style={{ padding: 0 }}>
        <span style={{ minWidth: 0 }}>
          <i className="fa-solid fa-robot"></i> Assistant IA{" "}
          {etat && !jamaisEssaye && (
            <span className={`badge-motif ${etat.ok ? "" : "badge-motif-alerte"}`}>{etat.ok ? "fonctionne" : "ne répond pas"}</span>
          )}
          <div className="info" style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>
            {etat ? etat.detail : "Lecture de l'état..."}
            {etat?.ok && etat.modele ? ` (${etat.modele})` : ""}
          </div>
        </span>
        <button type="button" className="bouton-admin bouton-admin-doux" onClick={tester} disabled={essai}>
          <i className="fa-solid fa-vial"></i> {essai ? <><span className="grind-spinner" /> Test…</> : "Tester"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Une discussion ------------------------------ */
function Discussion({ sessionToken, conversationId, onRetour }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const dernierRef = useRef("");

  const appliquer = useCallback((res) => {
    const signature = `${res.messages.length}-${res.messages.at(-1)?.id}-${res.conversation.ia_active}-${res.conversation.statut}`;
    if (signature === dernierRef.current) return;
    dernierRef.current = signature;
    setConversation(res.conversation);
    setMessages(res.messages);
  }, []);

  useEffect(() => {
    adminSupportLire(sessionToken, conversationId).then(appliquer).catch((err) => setErreur(err.message));
    const minuteur = setInterval(() => {
      if (document.visibilityState === "visible") {
        adminSupportLire(sessionToken, conversationId).then(appliquer).catch(() => {});
      }
    }, DELAI_DETAIL);
    return () => clearInterval(minuteur);
  }, [sessionToken, conversationId, appliquer]);

  async function action(promesse) {
    setErreur(null);
    try {
      const res = await promesse;
      dernierRef.current = "";
      appliquer(res);
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function repondre() {
    const message = texte.trim();
    if (!message || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await adminSupportRepondre(sessionToken, conversationId, message);
      setTexte("");
      dernierRef.current = "";
      appliquer(res);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (!conversation) {
    return (
      <>
        <button type="button" className="bouton-admin bouton-admin-doux" onClick={onRetour}>
          <i className="fa-solid fa-arrow-left"></i> Boîte de support
        </button>
        {erreur ? <div className="erreur" style={{ marginTop: 12 }}>{erreur}</div> : (
          <div className="info" style={{ marginTop: 12 }}><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>
        )}
      </>
    );
  }

  const ouverte = conversation.statut === "ouvert";

  return (
    <div className="discussion-support">
      <div className="entete-signalement" style={{ marginBottom: 12 }}>
        <button type="button" className="bouton-admin bouton-admin-doux" onClick={onRetour}>
          <i className="fa-solid fa-arrow-left"></i> Boîte
        </button>
        <strong style={{ fontSize: 16 }}>{conversation.username}</strong>
        <BadgeCompte badge={conversation.badge} taille={14} />
        {conversation.urgent && <span className="badge-motif badge-motif-alerte"><i className="fa-solid fa-triangle-exclamation"></i> Urgent</span>}
        {conversation.humain_demande && <span className="badge-motif"><i className="fa-solid fa-user-shield"></i> Équipe demandée</span>}
        {!ouverte && <span className="badge-motif">Terminée</span>}
      </div>

      {ouverte && (
        <div className="panneau-sanction" style={{ marginBottom: 12 }}>
          <div className="ligne-reglage" style={{ padding: 0 }}>
            <span>
              <i className="fa-solid fa-robot"></i> Assistant IA dans cette discussion
              <div className="info" style={{ fontSize: 12 }}>
                {conversation.ia_active ? "Actif : il répond à l'élève." : "En pause : tu parles directement à l'élève."}
              </div>
            </span>
            <Interrupteur
              actif={conversation.ia_active}
              onBasculer={() => action(adminSupportIA(sessionToken, conversationId, !conversation.ia_active))}
            />
          </div>
        </div>
      )}

      <FilSupport messages={messages} monType="equipe" vueEquipe />

      {erreur && <div className="erreur" style={{ marginBottom: 8 }}>{erreur}</div>}

      {ouverte ? (
        <>
          <textarea
            className="saisie-support"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder="Ta réponse à l'élève..."
          />
          <div className="info" style={{ fontSize: 12, margin: "6px 0 10px" }}>
            Quand tu réponds, l'assistant se met en pause automatiquement ; tu peux le réactiver avec l'interrupteur.
          </div>
          <div className="actions-admin">
            <button type="button" className="bouton-admin" onClick={repondre} disabled={envoi || !texte.trim()}>
              <i className="fa-solid fa-paper-plane"></i> {envoi ? <span className="grind-spinner" aria-label="Envoi" /> : "Répondre"}
            </button>
            <button
              type="button"
              className="bouton-admin bouton-admin-doux"
              onClick={() => action(adminSupportCloturer(sessionToken, conversationId))}
            >
              <i className="fa-solid fa-check"></i> Clore la discussion
            </button>
          </div>
        </>
      ) : (
        <div className="info">Cette discussion est terminée.</div>
      )}
    </div>
  );
}

/* --------------------------------- La boîte --------------------------------- */
export default function SalleSupport({ sessionToken }) {
  const [statut, setStatut] = useState("ouvert");
  const [liste, setListe] = useState([]);
  const [selection, setSelection] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    try {
      const res = await adminSupportListe(sessionToken, statut);
      setListe(res.conversations);
      setErreur(null);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [sessionToken, statut]);

  useEffect(() => {
    setChargement(true);
    charger();
  }, [charger]);

  // La liste se rafraîchit seule tant qu'on est dessus
  useEffect(() => {
    if (selection !== null) return undefined;
    const minuteur = setInterval(() => {
      if (document.visibilityState === "visible") charger();
    }, DELAI_LISTE);
    return () => clearInterval(minuteur);
  }, [selection, charger]);

  if (selection !== null) {
    return (
      <Discussion
        sessionToken={sessionToken}
        conversationId={selection}
        onRetour={() => {
          setSelection(null);
          charger();
        }}
      />
    );
  }

  return (
    <>
      <EtatAssistant sessionToken={sessionToken} />

      <div className="choix-categorie" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip ${statut === "ouvert" ? "chip-actif" : ""}`} onClick={() => setStatut("ouvert")}>Ouvertes</button>
        <button type="button" className={`chip ${statut === "clos" ? "chip-actif" : ""}`} onClick={() => setStatut("clos")}>Terminées</button>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {chargement && <div className="info"><i className="fa-solid fa-spinner fa-spin"></i> Chargement...</div>}
      {!chargement && !erreur && liste.length === 0 && (
        <div className="info"><i className="fa-solid fa-circle-check"></i> Aucune discussion.</div>
      )}

      <div className="admin-grille">
        {liste.map((c) => (
          <button key={c.id} type="button" className="carte-post carte-support" onClick={() => setSelection(c.id)}>
            <div className="entete-signalement">
              <strong style={{ fontSize: 15 }}>{c.username}</strong>
              <BadgeCompte badge={c.badge} taille={13} />
              {c.urgent && <span className="badge-motif badge-motif-alerte"><i className="fa-solid fa-triangle-exclamation"></i> Urgent</span>}
              {c.attente_equipe && <span className="badge-motif badge-motif-alerte">À répondre</span>}
              {!c.ia_active && c.statut === "ouvert" && <span className="badge-motif"><i className="fa-solid fa-robot"></i> pause</span>}
              <span className="date-signalement">{formaterDate(c.updated_at)}</span>
            </div>
            <div className="info" style={{ fontSize: 13, textAlign: "left" }}>
              {c.dernier_auteur === "utilisateur" ? "" : c.dernier_auteur === "ia" ? "Assistant : " : "Équipe : "}
              {c.dernier_message || "…"}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
