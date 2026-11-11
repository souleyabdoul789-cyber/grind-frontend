// Conditions générales d'utilisation (CGU) et politique de confidentialité de GRIND.
//
// ATTENTION — TEXTE À FAIRE RELIRE PAR UN JURISTE AVANT L'OUVERTURE AU PUBLIC.
// Il a été rédigé sous forme juridique, mais Claude n'est pas juriste et ne connaît ni la structure légale de
// GRIND, ni le droit applicable. Chaque mention « [À COMPLÉTER : ...] » est une information que seul le propriétaire
// du projet peut fournir ; ces mentions sont volontairement visibles pour qu'on ne puisse pas les oublier.
//
// Quand tu modifies ce texte, change aussi CGU_VERSION ici ET dans le serveur (moderation.py) :
// chaque compte devra alors accepter la nouvelle version à sa prochaine connexion.

export const CGU_VERSION = "2026-11-03";

export const DOCUMENTS = [
  {
    cle: "cgu",
    titre: "Conditions générales d'utilisation",
    intro:
      "Les présentes conditions générales d'utilisation (« CGU ») régissent l'accès et l'utilisation du service GRIND. En créant un compte, tu reconnais les avoir lues et acceptées.",
    articles: [
      {
        titre: "Article 1 — Objet et éditeur",
        texte:
          "GRIND est un service d'entraide scolaire entre élèves et étudiants, proposé dans un navigateur web (le « Service »). Il est édité par [À COMPLÉTER : dénomination, forme juridique et adresse de l'éditeur] (l'« Éditeur »), société mère G-SOCIETY, qui fournit l'identité et les clés d'accès. Contact : [À COMPLÉTER : adresse e-mail de contact].",
      },
      {
        titre: "Article 2 — Définitions",
        texte:
          "« Utilisateur » : toute personne titulaire d'un compte. « Compte » : espace personnel créé à l'inscription. « Contenu » : tout texte, image, vidéo, document, commentaire ou feuille de travail publié ou saisi dans le Service. « Administration » : les personnes habilitées par l'Éditeur pour modérer et administrer le Service (administrateur, associés, contrôleurs).",
      },
      {
        titre: "Article 3 — Accès au Service et âge minimum",
        texte:
          "Le Service est réservé aux personnes âgées d'au moins 11 ans. L'Utilisateur déclare un âge exact ; une déclaration inexacte peut entraîner la suspension ou la suppression du compte. Lorsque la loi applicable l'exige, l'Utilisateur mineur déclare disposer de l'autorisation de son représentant légal : [À COMPLÉTER : règles de consentement parental selon le droit applicable]. Un Utilisateur ne peut détenir qu'un seul compte.",
      },
      {
        titre: "Article 4 — Création du compte et sécurité",
        texte:
          "L'inscription exige un pseudo, une adresse e-mail valide et unique, un mot de passe et une clé d'accès G-SOCIETY, dont la validité n'est contrôlée qu'à l'inscription. L'adresse e-mail est vérifiée par un code à 7 chiffres envoyé par G-SOCIETY, valable 10 minutes, utilisable une seule fois et limité à 3 essais ; sans cette vérification, le compte n'est pas activé. L'Utilisateur garde ses identifiants confidentiels et s'interdit de communiquer son mot de passe ou un code de vérification à qui que ce soit : l'Éditeur ne les demande jamais. L'Utilisateur informe l'Administration sans délai de toute utilisation non autorisée de son compte. Un mot de passe oublié se réinitialise uniquement après validation d'un code envoyé à l'adresse e-mail du compte.",
      },
      {
        titre: "Article 5 — Règles d'utilisation",
        texte:
          "Sont interdits : le harcèlement ou l'intimidation d'un autre Utilisateur ; l'usurpation d'identité ou de rôle (notamment celui de « prof ») ; la publication de contenus illicites, haineux, violents, sexuellement explicites, trompeurs, publicitaires ou hors sujet ; la diffusion de données personnelles d'autrui sans son accord ; la tentative d'accéder à un compte, à une feuille de travail ou à des données sans autorisation ; la création de comptes multiples ou de noms de classes et de matières fictifs ou dénués de sens ; toute action visant à perturber ou à contourner la sécurité du Service.",
      },
      {
        titre: "Article 6 — Contenus des Utilisateurs",
        texte:
          "L'Utilisateur reste titulaire des droits sur les Contenus qu'il publie et garantit en avoir le droit. Il accorde à l'Éditeur, pour la durée de présence du Contenu sur le Service, une licence non exclusive et gratuite d'hébergement, de reproduction technique et d'affichage, strictement nécessaire au fonctionnement du Service. L'Administration peut masquer ou supprimer tout Contenu contraire aux CGU ou à la loi.",
      },
      {
        titre: "Article 7 — Classes, feuilles de travail et partage",
        texte:
          "Une classe est créée avec un niveau et une matière choisis dans le catalogue scolaire du Service, et ne se rejoint que par code d'invitation. Une feuille de travail est privée par défaut : elle n'est visible par un tiers qu'avec l'autorisation de son auteur ou, dans les conditions prévues par le Service, du responsable de la classe.",
      },
      {
        titre: "Article 8 — Signalement, modération, sanctions et examen",
        texte:
          "Tout Utilisateur peut signaler un contenu ou un compte et choisir de ne plus voir les contenus d'un compte (mesure personnelle et réversible). Les signalements sont examinés par des personnes de l'Administration, jamais par un algorithme. L'Administration peut ignorer un signalement, supprimer un contenu, suspendre un compte pour une durée limitée ou le bannir. Un compte suspendu ou banni ne peut plus se connecter ; ses publications et ses classes sont alors masquées ou suspendues mais conservées. La décision est motivée. Lorsque l'Administration l'autorise, la personne sanctionnée peut déposer une demande d'examen (une seule par décision) ; l'Administration consulte alors l'ensemble de ses contenus. Si l'examen est accepté, le compte et ses contenus sont rétablis ; s'il est refusé, la décision est définitive. Certaines décisions n'ouvrent pas droit à examen. Les signalements abusifs ou répétés peuvent eux-mêmes être sanctionnés.",
      },
      {
        titre: "Article 9 — Assistance et assistant automatisé",
        texte:
          "Le Service propose une assistance (« Contactez-nous ») qui combine un assistant automatisé et l'Administration. L'assistant est limité à l'aide sur le fonctionnement de GRIND, peut commettre des erreurs et n'a aucun pouvoir de décision sur les comptes. Les messages échangés avec l'assistant sont transmis à un prestataire d'intelligence artificielle pour produire la réponse (voir la politique de confidentialité). L'Utilisateur évite d'y saisir des informations sensibles. L'Administration peut lire ces conversations, prendre la main et désactiver l'assistant à tout moment.",
      },
      {
        titre: "Article 10 — Disponibilité du Service",
        texte:
          "Le Service est fourni « en l'état », en évolution continue. L'Éditeur s'efforce d'en assurer la disponibilité mais ne garantit ni l'absence d'interruption ni l'exactitude de l'aide apportée par d'autres Utilisateurs, qui n'est ni vérifiée ni garantie.",
      },
      {
        titre: "Article 11 — Responsabilité",
        texte:
          "Dans la limite permise par la loi applicable, l'Éditeur n'est pas responsable des Contenus publiés par les Utilisateurs, ni des dommages indirects résultant de l'utilisation du Service. Rien dans les présentes ne limite les droits que l'Utilisateur tient de la loi et auxquels il ne peut être renoncé. [À COMPLÉTER : vérification juridique de cette clause].",
      },
      {
        titre: "Article 12 — Propriété intellectuelle",
        texte:
          "Le Service, sa marque, son interface, ses illustrations et ses logiciels sont protégés. Aucun droit n'est cédé à l'Utilisateur en dehors du droit personnel et non exclusif d'utiliser le Service conformément aux CGU.",
      },
      {
        titre: "Article 13 — Données personnelles",
        texte:
          "Le traitement des données personnelles est décrit dans la politique de confidentialité ci-après, qui fait partie des présentes.",
      },
      {
        titre: "Article 14 — Fin du compte",
        texte:
          "L'Utilisateur peut cesser d'utiliser le Service à tout moment et demander la suppression de son compte depuis Paramètres › Contactez-nous. L'Éditeur peut suspendre ou supprimer un compte en cas de manquement aux CGU, dans les conditions de l'article 8.",
      },
      {
        titre: "Article 15 — Modification des CGU",
        texte:
          "Les CGU peuvent évoluer. Chaque nouvelle version est identifiée par une date et doit être acceptée à la connexion suivante pour continuer à utiliser le Service.",
      },
      {
        titre: "Article 16 — Droit applicable et litiges",
        texte:
          "Les présentes sont régies par [À COMPLÉTER : droit applicable]. En cas de litige, les parties recherchent d'abord une solution amiable via Paramètres › Contactez-nous ; à défaut, [À COMPLÉTER : juridiction compétente ou mode de règlement des litiges].",
      },
    ],
  },
  {
    cle: "confidentialite",
    titre: "Politique de confidentialité",
    intro:
      "Cette politique explique quelles données personnelles GRIND traite, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées et comment exercer tes droits.",
    articles: [
      {
        titre: "1. Responsable du traitement",
        texte:
          "Le responsable du traitement est [À COMPLÉTER : dénomination et adresse de l'Éditeur]. Contact pour toute question sur tes données : [À COMPLÉTER : adresse e-mail dédiée à la protection des données].",
      },
      {
        titre: "2. Données traitées",
        texte:
          "Compte : pseudo, adresse e-mail (vérifiée), mot de passe (conservé uniquement sous forme chiffrée irréversible, jamais en clair), identité G-SOCIETY liée à la clé d'accès, dates d'acceptation des CGU. Profil scolaire : âge, pays, niveau, matières de difficulté. Contenus : publications, commentaires, médias, documents, feuilles de travail, classes et leurs membres. Interactions : mentions « j'aime », signalements, comptes masqués, demandes d'aide. Assistance : messages envoyés à l'assistant et à l'Administration. Sécurité : adresse IP et horodatage des tentatives de connexion et de vérification, sessions ouvertes, codes de vérification (conservés sous forme d'empreinte, jamais en clair). Modération : signalements, décisions, motifs, demandes d'examen.",
      },
      {
        titre: "3. Finalités et bases légales",
        texte:
          "Fournir le Service et gérer ton compte (exécution des CGU) ; assurer la sécurité, prévenir la fraude et les abus, limiter les tentatives répétées (intérêt légitime) ; modérer les contenus et traiter les signalements (intérêt légitime, obligations légales) ; répondre à tes demandes d'assistance (exécution des CGU) ; envoyer les e-mails nécessaires à ton compte : vérification, réinitialisation, alerte de sécurité (exécution des CGU). GRIND n'utilise tes données ni pour de la publicité ni pour de la vente à des tiers. [À COMPLÉTER : validation juridique des bases légales selon le droit applicable].",
      },
      {
        titre: "4. Destinataires et prestataires",
        texte:
          "Tes données sont accessibles à l'Administration dans la limite de ses rôles. Elles sont traitées par des prestataires techniques : Render (hébergement du service), Aiven (base de données), Cloudinary (stockage des photos et vidéos), LiveKit (audio des classes), Groq (génération des réponses de l'assistant : le texte des messages qui lui sont adressés lui est transmis), Google (envoi des e-mails depuis le compte de G-SOCIETY) et G-SOCIETY (contrôle de la clé d'accès). Ces prestataires ne sont autorisés à traiter les données que pour fournir leur service.",
      },
      {
        titre: "5. Transferts hors de ton pays",
        texte:
          "Certains prestataires sont établis hors de ton pays et peuvent traiter des données sur leurs serveurs à l'étranger. [À COMPLÉTER : liste des pays de traitement et garanties applicables].",
      },
      {
        titre: "6. Durées de conservation",
        texte:
          "Inscription non vérifiée : supprimée au bout d'une heure. Code de vérification : valable 10 minutes, inutilisable ensuite. Session de connexion : 30 jours au plus, supprimée à la déconnexion et à chaque changement de mot de passe. Compte actif : tant que le compte existe. Conversations d'assistance : [À COMPLÉTER : durée, par exemple 12 mois]. Signalements et décisions de modération : [À COMPLÉTER : durée]. Après la suppression du compte : [À COMPLÉTER : délai de purge des données et des sauvegardes].",
      },
      {
        titre: "7. Sécurité",
        texte:
          "Mots de passe chiffrés de manière irréversible ; codes à usage unique, limités à 3 essais et à durée courte ; limitation des tentatives de connexion ; déconnexion effective côté serveur ; réponses identiques qu'une adresse e-mail soit connue ou non ; accès à l'administration restreint par rôle ; secrets techniques conservés hors du code et hors du navigateur. Aucun système n'étant infaillible, toute suspicion de compromission doit être signalée à l'Administration. [À COMPLÉTER : procédure de notification des violations de données].",
      },
      {
        titre: "8. Tes droits",
        texte:
          "Tu peux demander l'accès à tes données, leur rectification, leur effacement, la limitation ou l'opposition à leur traitement, leur portabilité, et retirer un consentement donné. Tu peux exercer ces droits depuis Paramètres › Contactez-nous ou à [À COMPLÉTER : adresse de contact]. Tu peux aussi introduire une réclamation auprès de [À COMPLÉTER : autorité de protection des données compétente].",
      },
      {
        titre: "9. Mineurs",
        texte:
          "GRIND est ouvert dès 11 ans. Nous limitons les données demandées au strict nécessaire et ne contactons pas les mineurs à des fins commerciales. [À COMPLÉTER : conditions du consentement du représentant légal selon le droit applicable].",
      },
      {
        titre: "10. Stockage local et traceurs",
        texte:
          "GRIND utilise le stockage local de ton navigateur uniquement pour garder ta session (jeton de connexion), ton pseudo, ton rôle et tes préférences. Il n'utilise ni cookie publicitaire ni traceur tiers.",
      },
      {
        titre: "11. Modification de cette politique",
        texte:
          "Cette politique peut évoluer. La version en vigueur est identifiée par sa date ; une nouvelle version doit être acceptée à la connexion suivante.",
      },
    ],
  },
];
