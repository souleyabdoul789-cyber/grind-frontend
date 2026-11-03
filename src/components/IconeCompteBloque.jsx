/** Silhouette de compte avec une pastille rouge : l'apparence d'un compte indisponible, comme sur WhatsApp. */
export default function IconeCompteBloque({ taille = 96 }) {
  return (
    <div className="icone-compte-bloque" style={{ width: taille, height: taille }} aria-hidden="true">
      <i className="fa-solid fa-user" style={{ fontSize: taille * 0.46 }}></i>
      <span className="icone-compte-pastille" style={{ width: taille * 0.4, height: taille * 0.4 }}>
        <i className="fa-solid fa-ban" style={{ fontSize: taille * 0.22 }}></i>
      </span>
    </div>
  );
}
