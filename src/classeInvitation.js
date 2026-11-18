export function ouvrirInvitationClasse(codeBrut) {
  const code = String(codeBrut || "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(code)) return false;
  window.dispatchEvent(new CustomEvent("grind-rejoindre-classe", { detail: code }));
  return true;
}
