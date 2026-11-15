import { Capacitor, registerPlugin } from "@capacitor/core";

const GrindDownloads = registerPlugin("GrindDownloads");

function echapperHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nomPdfSecurise(value) {
  const clean = String(value || "document-grind")
    .replace(/\\/g, "-")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 110) || "document-grind";
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

function ouvrirImpressionWeb({ titre, sousTitre, classe, auteur, contenu, nomFichier }) {
  // La fenêtre est ouverte synchroniquement depuis le clic utilisateur pour
  // éviter le blocage des pop-ups par les navigateurs.
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Le navigateur a bloqué la fenêtre PDF. Autorise les fenêtres surgissantes pour GRIND puis réessaie.");
  }

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapperHtml(nomFichier)}</title>
<style>
  @page { size: A4; margin: 18mm 17mm 19mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #202329; font-family: Arial, "DejaVu Sans", sans-serif; }
  header { border-bottom: 1px solid #c9cbd0; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { margin: 0 0 5px; font-size: 19pt; line-height: 1.2; }
  .meta { color: #606773; font-size: 9pt; line-height: 1.5; }
  pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; font-family: Arial, "DejaVu Sans", sans-serif; font-size: 10.5pt; line-height: 1.55; }
  footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e4e8; color: #747b87; font-size: 8pt; }
  @media screen { body { max-width: 210mm; min-height: 297mm; margin: 20px auto; padding: 18mm 17mm 19mm; box-shadow: 0 2px 18px rgba(0,0,0,.14); } }
  @media print {
    footer { position: fixed; bottom: -12mm; left: 0; right: 0; }
    footer::after { content: " · Page " counter(page); }
  }
</style>
</head>
<body>
<header>
  <h1>${echapperHtml(titre)}</h1>
  <div class="meta">${echapperHtml(classe)} · ${echapperHtml(auteur)}<br>${echapperHtml(sousTitre)}</div>
</header>
<main><pre>${echapperHtml(contenu)}</pre></main>
<footer>GRIND · Document personnel de classe · ${echapperHtml(new Date().toLocaleString("fr-FR"))}</footer>
<script>
  window.addEventListener("load", () => { window.focus(); window.print(); });
</script>
</body>
</html>`;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return { success: true, local: false, fileName: nomFichier };
}

export async function telechargerDocumentSallePdf({ titre, sousTitre, classe, auteur, contenu, nomFichier }) {
  const text = String(contenu ?? "");
  if (!text.trim()) throw new Error("Le document est vide : aucun PDF n'a été créé.");
  const filename = nomPdfSecurise(nomFichier);

  if (Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform()) {
    const result = await GrindDownloads.generateTextPdf({
      fileName: filename,
      title: String(titre || "Document de classe"),
      subtitle: String(sousTitre || ""),
      className: String(classe || "Classe GRIND"),
      author: String(auteur || ""),
      content: text,
    });
    if (!result?.success || !result?.exists || !result?.fileName) {
      throw new Error("Le PDF n'a pas pu être enregistré dans Téléchargements/GRIND DOWNLOAD FILES.");
    }
    return {
      success: true,
      local: true,
      fileName: result.fileName,
      path: result.path || null,
      uri: result.uri || null,
      directory: result.directory || "Download/GRIND DOWNLOAD FILES",
      size: Number(result.size) || 0,
    };
  }

  return ouvrirImpressionWeb({ titre, sousTitre, classe, auteur, contenu: text, nomFichier: filename });
}
