import { useCallback, useEffect, useState } from "react";
import { definirPaysBloque, listerPaysBloques, supprimerPaysBloque } from "../api.js";

export default function SallePays({ sessionToken }) {
  const [pays, setPays] = useState([]);
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Vous êtes peut-être en période de vacances. Pour éviter que le réseau ne devienne un espace de distraction, nous avons temporairement suspendu son accès dans votre pays. Veuillez nous excuser pour cette décision.");
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const charger = useCallback(() => listerPaysBloques(sessionToken).then(r => setPays(r.pays || [])).catch(e => setErreur(e.message)).finally(() => setChargement(false)), [sessionToken]);
  useEffect(() => { charger(); }, [charger]);
  async function sauvegarder(e) {
    e.preventDefault(); setEnvoi(true); setErreur("");
    try { await definirPaysBloque(sessionToken, { code, nom, message, actif: true }); setNom(""); setCode(""); await charger(); }
    catch (e) { setErreur(e.message); } finally { setEnvoi(false); }
  }
  async function retirer(codePays) {
    setErreur(""); try { await supprimerPaysBloque(sessionToken, codePays); await charger(); } catch (e) { setErreur(e.message); }
  }
  return <section className="admin-pays">
    <div className="admin-pays-intro"><i className="fa-solid fa-earth-africa"/><div><h2>Disponibilité régionale</h2><p>Suspendre l'accès à GRIND dans un pays, indépendamment du pays indiqué dans le profil.</p></div></div>
    <form className="admin-pays-form" onSubmit={sauvegarder}><label>Nom du pays<input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex. Niger" maxLength={100} required /></label><label>Code pays ISO<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="NE" maxLength={2} pattern="[A-Z]{2}" required /></label><label>Message affiché aux utilisateurs<textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={1200}/></label><button disabled={envoi}>{envoi ? <i className="fa-solid fa-circle-notch fa-spin"/> : <><i className="fa-solid fa-ban"/> Suspendre ce pays</>}</button></form>
    {erreur && <p className="erreur">{erreur}</p>}
    <div className="admin-pays-list"><h3>Pays configurés</h3>{chargement ? <div className="grind-inline-loader"><span className="grind-spinner"/> Chargement des pays…</div> : pays.length === 0 ? <p>Aucun pays suspendu.</p> : pays.map(p => <article key={p.code}><div><strong>{p.nom}</strong><small>{p.code} · {p.actif ? "Accès suspendu" : "Suspendu désactivé"}</small></div><button onClick={() => retirer(p.code)} type="button" title="Retirer la restriction"><i className="fa-solid fa-trash"/> Retirer</button></article>)}</div>
    <p className="admin-pays-note"><i className="fa-solid fa-circle-info"/> Le blocage automatique selon la localisation réseau nécessite un service de localisation configuré côté serveur. Sans ce service, GRIND ne peut pas appliquer automatiquement une restriction à partir de l'adresse IP.</p>
  </section>;
}
