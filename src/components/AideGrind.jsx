import { useEffect, useRef, useState } from "react";

const RUBRIQUES = [
  {
    id: "classes", nom: "Classes", icone: "fa-school", intro: "Les classes regroupent les élèves autour d'un même cadre scolaire et facilitent l'entraide.", sections: [
      { titre: "Créer ou rejoindre une classe", points: ["Ouvre l'onglet Classes depuis la navigation GRIND.", "Pour créer une classe, utilise l'action de création et renseigne les informations demandées.", "Pour rejoindre une classe, saisis son code d'invitation ou utilise le QR code fourni par un membre autorisé.", "Une classe rejoint apparaît dans ta liste. Sélectionne-la pour ouvrir son espace."] },
      { titre: "Gérer une classe", points: ["Les actions disponibles dépendent de ton rôle et des autorisations accordées dans cette classe.", "Les codes d'invitation peuvent être partagés avec les personnes que tu souhaites inviter.", "Une classe peut contenir un espace de discussion et des activités en salle. Ces espaces ne sont pas interchangeables."] },
      { titre: "À retenir", points: ["Un code d'invitation donne accès à l'espace auquel il correspond : partage-le uniquement avec les personnes concernées.", "Certaines opérations, comme rejoindre une classe, nécessitent une connexion Internet."] },
    ],
  },
  {
    id: "discussions", nom: "Discussions", icone: "fa-comments", intro: "Les discussions permettent aux membres d'échanger dans un groupe lié à leur classe.", sections: [
      { titre: "Envoyer un message", points: ["Ouvre la discussion depuis l'espace de ta classe.", "Écris ton message puis utilise le bouton d'envoi. Tu peux répondre à un message et mentionner un membre lorsque l'interface le propose.", "Le menu des pièces jointes permet de choisir une image, une vidéo ou un document PDF/DOCX.", "Tu peux également enregistrer un message vocal avec le bouton du microphone."] },
      { titre: "Groupes et membres", points: ["Les informations du groupe affichent son nom, ses membres et son code d'invitation.", "Selon ton rôle, tu peux gérer certaines invitations ou actions de modération. Les limites sont appliquées par le serveur.", "La capacité affichée dans l'espace de discussion est distincte de la capacité de la salle audio."] },
      { titre: "Hors ligne", points: ["Les messages déjà chargés peuvent rester consultables sur cet appareil.", "Les messages en attente sont conservés localement et leur envoi reprend lorsque la connexion revient.", "La lecture hors ligne ne signifie pas que les nouveaux messages sont déjà transmis aux autres membres."] },
      { titre: "Salle audio", points: ["La salle audio est un espace séparé de la discussion écrite.", "Pour participer, autorise l'accès au microphone lorsque Android ou le navigateur le demande.", "La salle de classe audio est prévue pour un maximum de 10 participants. Utilise le mode paysage lorsque l'interface le demande."] },
    ],
  },
  {
    id: "comptes", nom: "Comptes", icone: "fa-users", intro: "Tu peux mémoriser plusieurs comptes GRIND sur un même appareil et passer de l'un à l'autre.", sections: [
      { titre: "Ajouter un compte", points: ["Ouvre le gestionnaire de comptes depuis la navigation ou le menu de compte.", "Choisis Ajouter un compte, puis connecte-toi avec les identifiants de ce compte.", "Le nombre de comptes mémorisables est fixé par le serveur et peut dépendre de l'appareil ou de la configuration du compte."] },
      { titre: "Changer de compte", points: ["Sélectionne le compte souhaité dans la liste des comptes mémorisés.", "GRIND reverrouille les sessions avant le changement et demande le PIN du compte sélectionné.", "Chaque compte garde ses propres données locales et son propre état de session."] },
      { titre: "Sécurité", points: ["Ne partage jamais ton mot de passe, ton PIN ou un code de vérification.", "Sur un appareil partagé, déconnecte les comptes que tu ne souhaites plus y conserver.", "La limite affichée est décidée par le serveur : l'interface ne peut pas l'augmenter."] },
    ],
  },
  {
    id: "signalements", nom: "Signalements", icone: "fa-flag", intro: "Le signalement permet de transmettre un contenu ou un comportement à l'équipe de modération.", sections: [
      { titre: "Signaler un contenu", points: ["Ouvre le menu d'actions du post ou du commentaire concerné, puis choisis Signaler.", "Sélectionne le motif qui correspond le mieux à la situation et ajoute les précisions demandées.", "Envoie le signalement une seule fois, avec des informations factuelles et utiles."] },
      { titre: "Signaler un compte", points: ["Depuis le profil ou le menu d'actions du compte, utilise la fonction de signalement lorsqu'elle est disponible.", "Un signalement transmet une information à l'équipe ; il ne bloque pas automatiquement un compte et ne garantit pas une sanction.", "L'équipe examine les éléments et décide des suites selon les règles de GRIND."] },
      { titre: "Ne plus voir un compte", points: ["La fonction de blocage ou de masquage peut réduire l'affichage des contenus d'un compte.", "Le blocage et le signalement sont deux actions différentes : le premier agit sur ton affichage, le second alerte la modération."] },
    ],
  },
  {
    id: "documents", nom: "Documents", icone: "fa-file-lines", intro: "GRIND permet de partager des fichiers dans les espaces qui proposent une pièce jointe.", sections: [
      { titre: "Dans une discussion", points: ["Ouvre le menu de pièce jointe puis choisis Image, Vidéo ou Document.", "Pour les documents de discussion, les formats proposés sont PDF et DOCX.", "Après sélection, vérifie le nom du fichier puis envoie le message.", "Un document reçu peut être enregistré et ouvert depuis la conversation."] },
      { titre: "Dans les annonces officielles", points: ["Certaines annonces officielles peuvent contenir un document PDF ou DOCX.", "Ouvre la pièce jointe depuis l'annonce pour consulter ou télécharger le fichier.", "Les annonces officielles sont publiées par le compte GRIND ; elles ne sont pas des publications ordinaires d'élèves."] },
      { titre: "Conseils", points: ["Vérifie le fichier avant de l'envoyer et évite les documents qui contiennent des informations privées d'autres personnes.", "Un fichier non encore téléchargé sur l'appareil peut ne pas être accessible sans connexion."] },
    ],
  },
  {
    id: "publications", nom: "Publications", icone: "fa-newspaper", intro: "Le fil d'actualité rassemble les publications et les demandes d'entraide de la communauté.", sections: [
      { titre: "Publier", points: ["Ouvre le Fil d'actualité puis l'action de création de publication.", "Choisis la catégorie proposée : un problème à résoudre ou une démonstration/astuce à partager.", "Pour une demande d'aide, explique clairement ce qui bloque et indique la date limite lorsqu'elle est demandée.", "Relis ton contenu avant de publier : il doit rester utile, respectueux et compréhensible."] },
      { titre: "Participer", points: ["Tu peux consulter les publications, réagir et commenter lorsque ces actions sont disponibles.", "Utilise le signalement si une publication ou un commentaire enfreint les règles de la communauté.", "Les publications de type problème peuvent comporter une échéance : vérifie les informations affichées sur la publication."] },
      { titre: "Annonces officielles", points: ["Le fil peut également afficher des annonces du compte officiel GRIND, parfois épinglées ou marquées comme importantes.", "Une annonce non importante peut être masquée depuis son menu d'action lorsqu'il est proposé.", "Les annonces officielles sont des informations de service ; ne les confonds pas avec les publications des membres."] },
    ],
  },
  {
    id: "library", nom: "Library", icone: "fa-book-open", intro: "La Library est l'espace de recherche et de partage des documents disponibles dans GRIND.", sections: [
      { titre: "Rechercher et consulter", points: ["Ouvre Library depuis la navigation GRIND.", "Utilise la recherche pour retrouver un document par son titre ou les informations disponibles.", "Ouvre un document pour consulter sa fiche et, lorsque l'aperçu est pris en charge, afficher son contenu.", "La fiche du document permet aussi d'accéder aux commentaires lorsqu'ils sont disponibles."] },
      { titre: "Partager un document", points: ["Utilise l'action de partage dans Library.", "Choisis un fichier non vide, renseigne son titre et, si nécessaire, une description.", "La taille maximale actuellement acceptée par le service est de 30 Mo.", "L'envoi affiche sa progression. Ne ferme pas la page avant la fin de l'opération."] },
      { titre: "Télécharger et commenter", points: ["Ouvre la fiche du document puis utilise l'action de téléchargement.", "Tu peux ajouter un commentaire et consulter ceux déjà publiés lorsque la connexion est disponible.", "Une partie des documents déjà chargés peut rester visible dans le cache local ; un fichier absent du cache nécessite une connexion pour être récupéré."] },
      { titre: "Library et discussions", points: ["Library et les pièces jointes de discussion sont deux espaces différents.", "Un document partagé dans une conversation reste attaché à cette conversation ; sa présence dans Library dépend de l'action de partage utilisée."] },
    ],
  },
  {
    id: "parametres", nom: "Paramètres", icone: "fa-sliders", intro: "Les paramètres regroupent les préférences de ton compte et les moyens d'obtenir de l'aide.", sections: [
      { titre: "Identité et notifications", points: ["Tu peux consulter ton identité et modifier le prénom et le nom associés au compte.", "Les préférences de notification disponibles incluent les demandes d'aide sur tes matières et les invitations de classe.", "Ton profil permet de modifier ton nom de profil et de personnaliser ton avatar."] },
      { titre: "PIN et accès", points: ["Le PIN protège l'accès au compte et est redemandé selon la politique de sécurité GRIND.", "Si tu as oublié ton PIN, utilise le parcours de récupération affiché sur l'écran de vérification.", "Ne communique jamais ton PIN, ton mot de passe ni un code reçu par e-mail."] },
      { titre: "Contacter l'équipe", points: ["Contactez-nous ouvre une conversation avec l'assistant d'aide GRIND.", "Tu peux demander à parler à l'équipe à tout moment. Quand un membre de l'équipe prend la main, l'assistant se met en pause dans cette conversation.", "Les Conditions d'utilisation sont accessibles depuis Paramètres."] },
    ],
  },
];

export default function AideGrind({ onFermer }) {
  const [ongletActif, setOngletActif] = useState("classes");
  const retourRef = useRef({ onFermer });
  retourRef.current = { onFermer };

  useEffect(() => {
    const gererRetour = (event) => {
      if (event.defaultPrevented) return;
      retourRef.current.onFermer?.();
      event.preventDefault();
    };
    window.addEventListener("grind-back", gererRetour);
    return () => window.removeEventListener("grind-back", gererRetour);
  }, []);

  const rubrique = RUBRIQUES.find((item) => item.id === ongletActif) || RUBRIQUES[0];

  return (
    <div className="grind-help-overlay" role="dialog" aria-modal="true" aria-labelledby="grind-help-title">
      <div className="grind-help-page">
        <header className="grind-help-header">
          <div className="grind-help-brand">
            <span className="grind-help-mark"><i className="fa-solid fa-life-ring" aria-hidden="true" /></span>
            <div>
              <p>GUIDE D'UTILISATION</p>
              <h2 id="grind-help-title">Centre d'aide GRIND</h2>
              <small>Comprendre les espaces et utiliser les fonctions de la plateforme.</small>
            </div>
          </div>
          <button type="button" className="grind-help-close" onClick={onFermer} aria-label="Fermer l'aide">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <nav className="grind-help-tabs" aria-label="Rubriques du centre d'aide">
          {RUBRIQUES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`grind-help-tab ${ongletActif === item.id ? "active" : ""}`}
              onClick={() => setOngletActif(item.id)}
              aria-current={ongletActif === item.id ? "page" : undefined}
            >
              <i className={`fa-solid ${item.icone}`} aria-hidden="true" />
              <span>{item.nom}</span>
            </button>
          ))}
        </nav>

        <main className="grind-help-content" key={rubrique.id}>
          <div className="grind-help-intro">
            <span className="grind-help-intro-icon"><i className={`fa-solid ${rubrique.icone}`} aria-hidden="true" /></span>
            <div>
              <p>RUBRIQUE {String(RUBRIQUES.findIndex((item) => item.id === rubrique.id) + 1).padStart(2, "0")}</p>
              <h3>{rubrique.nom}</h3>
              <span>{rubrique.intro}</span>
            </div>
          </div>

          <div className="grind-help-sections">
            {rubrique.sections.map((section, index) => (
              <section className="grind-help-section" key={section.titre}>
                <div className="grind-help-section-title">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h4>{section.titre}</h4>
                </div>
                <ol>
                  {section.points.map((point, pointIndex) => (
                    <li key={`${section.titre}-${pointIndex}`}>{point}</li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </main>

        <footer className="grind-help-footer">
          <span><i className="fa-solid fa-circle-info" aria-hidden="true" /> Les écrans et actions disponibles peuvent varier selon ton rôle, tes droits et la version de GRIND.</span>
          <button type="button" onClick={onFermer}>Terminer la consultation</button>
        </footer>
      </div>
    </div>
  );
}
