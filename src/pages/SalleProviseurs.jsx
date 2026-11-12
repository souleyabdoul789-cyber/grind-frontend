import { useCallback, useEffect, useState } from "react";
import {
  listerCandidaturesProviseurs,
  telechargerDocumentProviseur,
  traiterCandidatureProviseur,
} from "../api.js";

export default function SalleProviseurs({ sessionToken }) {
  const [lignes, setLignes] = useState([]);
  const [filtre, setFiltre] = useState("en_attente");
  const [etablissements, setEtablissements] = useState({});
  const [notes, setNotes] = useState({});
  const [moderation, setModeration] = useState({});
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [action, setAction] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try { setLignes(await listerCandidaturesProviseurs(sessionToken, filtre)); }
    catch (err) { setErreur(err.message); }
    finally { setChargement(false); }
  }, [sessionToken, filtre]);

  useEffect(() => { charger(); }, [charger]);

  async function ouvrirDocument(doc) {
    setErreur("");
    try {
      const blob = await telechargerDocumentProviseur(sessionToken, doc.id);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = doc.nom || `justificatif-${doc.id}`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(url);
    } catch (err) { setErreur(err.message); }
  }

  async function traiter(candidature, decision) {
    const id = candidature.id;
    setAction(`${id}:${decision}`);
    setErreur("");
    try {
      await traiterCandidatureProviseur(sessionToken, {
        candidature_id: id,
        decision,
        etablissements: (etablissements[id] || candidature.etablissement_declare).split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean),
        message_candidat: notes[id] || "",
        moderation_locale: !!moderation[id],
      });
      await charger();
    } catch (err) { setErreur(err.message); }
    finally { setAction(null); }
  }

  return (
    <section className="admin-prov">
      <div className="admin-prov-entete">
        <div>
          <h2>Candidatures proviseur / direction</h2>
          <p>Les pièces d'identité restent privées et ne sont accessibles qu'à l'administrateur.</p>
        </div>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer les candidatures">
          <option value="en_attente">En attente</option>
          <option value="approuve">Approuvées</option>
          <option value="rejete">Rejetées</option>
          <option value="toutes">Toutes</option>
        </select>
      </div>
      {erreur && <div className="erreur" role="alert">{erreur}</div>}
      {chargement && <p className="info">Chargement...</p>}
      {!chargement && lignes.length === 0 && <p className="info">Aucune candidature dans cette catégorie.</p>}
      <div className="admin-prov-liste">
        {lignes.map((c) => (
          <article className="admin-prov-carte" key={c.id}>
            <header>
              <strong>{c.prenom} {c.nom}</strong>
              <span className={`admin-prov-statut statut-${c.statut}`}>{c.statut.replace("_", " ")}</span>
            </header>
            <p><b>Profil :</b> @{c.username}</p>
            <p><b>Téléphone de contact :</b> {c.telephone}</p>
            <p><b>Établissement déclaré :</b> {c.etablissement_declare}</p>
            <div className="admin-prov-docs">
              <b>Documents privés</b>
              {c.documents.map((doc) => (
                <button type="button" className="bouton-admin bouton-admin-doux" key={doc.id} onClick={() => ouvrirDocument(doc)}>
                  <i className="fa-solid fa-lock"></i> {doc.type.replaceAll("_", " ")} · {Math.ceil(doc.taille / 1024)} Ko · ouvrir
                </button>
              ))}
            </div>
            {c.statut === "en_attente" && (
              <div className="admin-prov-decision">
                <label>Établissement(s) autorisé(s) — sépare les noms par une virgule ou un retour à la ligne
                  <textarea rows="2" value={etablissements[c.id] ?? c.etablissement_declare} onChange={(e) => setEtablissements((v) => ({ ...v, [c.id]: e.target.value }))} />
                </label>
                <label>Message destiné au candidat (facultatif)
                  <textarea rows="2" value={notes[c.id] || ""} onChange={(e) => setNotes((v) => ({ ...v, [c.id]: e.target.value }))} />
                </label>
                <label className="admin-prov-check">
                  <input type="checkbox" checked={!!moderation[c.id]} onChange={(e) => setModeration((v) => ({ ...v, [c.id]: e.target.checked }))} />
                  Autoriser la modération locale dans cet établissement
                </label>
                <div className="admin-prov-actions">
                  <button type="button" disabled={!!action} onClick={() => traiter(c, "approuver")}>{action === `${c.id}:approuver` ? <span className="grind-spinner" aria-label="Traitement" /> : "Approuver"}</button>
                  <button type="button" className="bouton-admin bouton-admin-doux" disabled={!!action} onClick={() => traiter(c, "rejeter")}>{action === `${c.id}:rejeter` ? <span className="grind-spinner" aria-label="Traitement" /> : "Rejeter"}</button>
                </div>
              </div>
            )}
            {c.statut !== "en_attente" && c.note_admin && <p><b>Note interne (administration) :</b> {c.note_admin}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
