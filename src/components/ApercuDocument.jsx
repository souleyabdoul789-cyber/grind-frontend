import { useEffect, useRef, useState } from "react";
import { chargerApercuDocumentLibrary } from "../api.js";
import { telechargerDocumentLibrary } from "../libraryMedia.js";

const TYPE_PDF = "application/pdf";
const TYPES_WORD = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const TYPES_TABLEUR = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

function normaliserCellule(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleString("fr-FR");
  return String(value);
}

export default function ApercuDocument({ document, sessionToken }) {
  const stylesRef = useRef(null);
  const contenuRef = useRef(null);
  const urlRef = useRef(null);
  const classeurRef = useRef(null);
  const [etat, setEtat] = useState("chargement");
  const [erreur, setErreur] = useState("");
  const [urlPdf, setUrlPdf] = useState("");
  const [feuilles, setFeuilles] = useState([]);
  const [feuilleActive, setFeuilleActive] = useState("");
  const [lignes, setLignes] = useState([]);
  const [nombreLignes, setNombreLignes] = useState(0);
  const [telechargement, setTelechargement] = useState(false);
  const [erreurTelechargement, setErreurTelechargement] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let actif = true;
    setEtat("chargement"); setErreur(""); setUrlPdf(""); setFeuilles([]); setFeuilleActive(""); setLignes([]);
    if (contenuRef.current) contenuRef.current.replaceChildren();
    if (stylesRef.current) stylesRef.current.replaceChildren();
    classeurRef.current = null;

    async function charger() {
      try {
        const blob = await chargerApercuDocumentLibrary(sessionToken, document.id, controller.signal);
        if (!actif) return;
        const extension = String(document.fichier_nom || "").split(".").pop().toLowerCase();
        if (document.fichier_type === TYPE_PDF || extension === "pdf") {
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          setUrlPdf(url);
          setEtat("pret");
          return;
        }
        const buffer = await blob.arrayBuffer();
        if (TYPES_WORD.includes(document.fichier_type) || extension === "docx") {
          const { renderAsync } = await import("docx-preview");
          if (!actif || !contenuRef.current || !stylesRef.current) return;
          await renderAsync(buffer, contenuRef.current, stylesRef.current, {
            className: "grind-docx", inWrapper: true, ignoreWidth: true,
            ignoreHeight: true, breakPages: true, renderHeaders: true, renderFooters: true,
          });
          if (actif) setEtat("pret");
          return;
        }
        if (TYPES_TABLEUR.includes(document.fichier_type) || ["xlsx", "xls", "csv"].includes(extension)) {
          const XLSX = await import("xlsx");
          const classeur = XLSX.read(buffer, { type: "array", cellDates: true, dense: true });
          if (!classeur.SheetNames?.length) throw new Error("Aucune feuille exploitable dans ce fichier.");
          classeurRef.current = classeur;
          setFeuilles(classeur.SheetNames);
          afficherFeuille(classeur, classeur.SheetNames[0], XLSX);
          if (actif) setEtat("pret");
          return;
        }
        throw new Error("Ce format ne possède pas encore de lecteur intégré.");
      } catch (cause) {
        if (actif && cause.name !== "AbortError") {
          setErreur(cause.message || "Impossible de lire ce document.");
          setEtat("erreur");
        }
      }
    }
    charger();
    return () => {
      actif = false;
      controller.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [document.id, document.fichier_nom, document.fichier_type, sessionToken]);

  function afficherFeuille(classeur, nom, XLSXModule = null) {
    const XLSX = XLSXModule;
    if (!classeur || !nom) return;
    const feuille = classeur.Sheets[nom];
    const rangee = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: "", raw: false });
    const maxLignes = 150;
    const maxColonnes = 24;
    const visibles = rangee.slice(0, maxLignes).map(ligne => ligne.slice(0, maxColonnes).map(normaliserCellule));
    setFeuilleActive(nom);
    setNombreLignes(rangee.length);
    setLignes(visibles);
  }

  async function changerFeuille(nom) {
    try {
      const XLSX = await import("xlsx");
      afficherFeuille(classeurRef.current, nom, XLSX);
    } catch {
      setErreur("Cette feuille n'a pas pu être ouverte.");
      setEtat("erreur");
    }
  }

  async function telecharger() {
    if (telechargement) return;
    setTelechargement(true);
    setErreurTelechargement("");
    try {
      await telechargerDocumentLibrary(sessionToken, document);
    } catch (cause) {
      setErreurTelechargement(cause.message || "Le document n'a pas pu être téléchargé.");
    } finally {
      setTelechargement(false);
    }
  }

  const typeDocument = document.fichier_type === TYPE_PDF ? "PDF" : TYPES_WORD.includes(document.fichier_type) ? "Word" : "Tableur";
  const boutonTelecharger = (texte = false) => (
    <button type="button" onClick={telecharger} disabled={telechargement}
      title="Télécharger le document" aria-label="Télécharger le document">
      {telechargement ? <i className="fa-solid fa-circle-notch fa-spin" /> : <i className="fa-solid fa-download" />}
      {texte ? (telechargement ? " Enregistrement…" : " Télécharger le fichier") : null}
    </button>
  );

  return (
    <div className="library-preview-body">
      <div className="library-preview-toolbar">
        <div><span className="library-preview-type">{typeDocument}</span><span>{document.fichier_nom}</span></div>
        {boutonTelecharger()}
      </div>
      {erreurTelechargement && <div className="library-preview-status library-preview-error" role="alert">{erreurTelechargement}</div>}
      {etat === "chargement" && <div className="library-preview-status"><span className="grind-spinner" /> Préparation de l'aperçu…</div>}
      {etat === "erreur" && <div className="library-preview-status library-preview-error"><i className="fa-solid fa-circle-exclamation" /><p>{erreur}</p>{boutonTelecharger(true)}</div>}
      {etat === "pret" && urlPdf && <iframe className="library-preview-pdf" title={`Aperçu de ${document.titre}`} src={urlPdf} />}
      {etat === "pret" && (TYPES_WORD.includes(document.fichier_type) || String(document.fichier_nom || "").toLowerCase().endsWith(".docx")) && <div className="library-docx-scroll"><div ref={stylesRef} className="library-docx-styles" /><div ref={contenuRef} className="library-docx-content" /></div>}
      {etat === "pret" && feuilles.length > 0 && <div className="library-sheet-preview">
        <nav className="library-sheet-tabs" aria-label="Feuilles du classeur">{feuilles.map(nom => <button key={nom} type="button" className={nom === feuilleActive ? "actif" : ""} onClick={() => changerFeuille(nom)}>{nom}</button>)}</nav>
        <div className="library-sheet-scroll"><table><tbody>{lignes.map((ligne, index) => <tr key={index}>{ligne.map((cellule, colonne) => index === 0 ? <th key={colonne}>{cellule || " "}</th> : <td key={colonne}>{cellule}</td>)}</tr>)}</tbody></table></div>
        <p className="library-sheet-note">Aperçu des {Math.min(nombreLignes, 150)} premières lignes et 24 colonnes maximum. Télécharge le fichier pour consulter l'intégralité du classeur.</p>
      </div>}
    </div>
  );
}
