// Texte des conditions d'utilisation de GRIND.
// Quand tu modifies ce texte, change aussi CGU_VERSION dans le serveur
// (moderation.py) : chaque compte devra alors les accepter de nouveau.

export const CGU_VERSION = "2026-11-02";

export const CGU_SECTIONS = [
  {
    titre: "1. Qui nous sommes",
    texte:
      "GRIND est un service de G-SOCIETY dédié à l'entraide scolaire entre élèves. Comme GLITCH, il repose sur l'infrastructure centrale Pluton, mais fonctionne avec son propre système de compte. GRIND s'utilise directement dans le navigateur, sur téléphone comme sur ordinateur.",
  },
  {
    titre: "2. Deux comptes distincts",
    texte:
      "Un compte G-SOCIETY (identité centrale, utilisée pour générer des clés d'accès) est distinct de ton compte GRIND (pseudo et mot de passe propres à GRIND, créés séparément). Ta clé API G-SOCIETY catégorie grind n'est vérifiée qu'une seule fois, au moment de la création de ton compte GRIND : elle prouve que tu possèdes un compte G-SOCIETY légitime, rien de plus.",
  },
  {
    titre: "3. Clé API",
    texte:
      "La génération d'une clé catégorie grind suit les mêmes règles que les autres services : une génération toutes les 72 heures, durée de vie maximale de 90 jours.",
  },
  {
    titre: "4. Comportements interdits",
    texte:
      "Harcèlement ou intimidation envers un autre élève, y compris dans une classe ou une session d'aide ; usurpation du rôle « prof » pour induire en erreur ; contenu hors-sujet, publicitaire, choquant ou malveillant dans le fil d'actu ; tentative de contourner la confidentialité des feuilles de travail d'un autre utilisateur sans autorisation.",
  },
  {
    titre: "5. Spécificités GRIND",
    texte:
      "Un post de catégorie « problème » doit comporter une date limite. Passé ce délai sans résolution, il expire automatiquement et devient non-répondable. Une classe créée par un utilisateur ne se rejoint que par lien d'invitation, jamais par recherche publique. La feuille de travail de chaque utilisateur est privée par défaut ; la rendre visible à un tiers nécessite une autorisation explicite du chef de classe ou du « prof » désigné pour la session.",
  },
  {
    titre: "6. Signalements, modération et examen",
    texte:
      "Tu peux signaler un post, un commentaire ou un compte depuis le menu à trois points ou le bouton drapeau, et choisir de ne plus voir les contenus d'un compte (tu peux les réafficher à tout moment). Les signalements sont examinés par l'administration de GRIND, qui peut ignorer le signalement, supprimer le contenu, suspendre un compte pour une durée limitée ou le bannir. Ces décisions sont prises par des personnes, jamais par un algorithme. Un compte suspendu ou banni ne peut plus se connecter : ses publications et ses classes sont masquées ou suspendues, mais conservées. Quand l'administration l'autorise, la personne peut demander un examen : s'il est accepté, le compte est rétabli avec ses contenus ; s'il est refusé, la décision est définitive. Certaines décisions n'ouvrent pas droit à un examen. Les signalements abusifs ou en rafale peuvent eux-mêmes être sanctionnés.",
  },
  {
    titre: "7. Données collectées",
    texte:
      "À l'inscription du profil, GRIND collecte ton âge, ton pays, ta classe ou filière, et les matières où tu déclares des difficultés. Ces informations servent uniquement à la mise en relation avec d'autres élèves (matching) et ne sont pas partagées avec des tiers. Les signalements et sanctions sont conservés par l'administration pour faire respecter ces conditions.",
  },
  {
    titre: "8. Limitation de responsabilité",
    texte:
      "GRIND met en relation des élèves entre eux ; l'exactitude de l'aide fournie par un pair n'est ni vérifiée ni garantie par G-SOCIETY. Le service est fourni « en l'état », en développement actif.",
  },
  {
    titre: "9. Résiliation",
    texte:
      "Tu peux cesser d'utiliser GRIND à tout moment. G-SOCIETY se réserve le droit de suspendre ou de bannir un compte GRIND en cas de manquement grave ou répété aux présentes conditions.",
  },
  {
    titre: "10. Contact",
    texte:
      "Pour toute question ou signalement concernant GRIND : mêmes canaux que G-SOCIETY (chaîne Telegram officielle).",
  },
];
