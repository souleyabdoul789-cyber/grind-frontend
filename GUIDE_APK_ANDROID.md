# GRIND 2.8.6 — APK Android, Google Sign-In et notifications push

## Ce que contient cette livraison

- L'interface React existante est conservée dans Capacitor : ce n'est pas une réécriture Kotlin.
- `SalleClasse` verrouille l'écran en paysage pendant la salle réelle ; l'orientation redevient libre à la sortie.
- Le bouton `@` de la discussion de groupe reste flottant et n'apparaît que lorsqu'une mention non lue existe.
- Le client OAuth Web existant reste utilisé côté React ; l'APK utilise le plugin Google natif et le backend continue de vérifier le jeton ID.
- Le plugin Capacitor Push Notifications est installé. Le backend peut envoyer les push FCM pour les mentions, interactions de publications, messages/mentions de discussion, activités Library, annonces officielles, demandes d'aide, arrivée d'un membre en classe et réponses du support.
- La création de playlists est libre ; la Library liste toutes les playlists publiques et les documents de recherche sont paginés.

## 1. Variables déjà ajoutées

Dans le dépôt GitHub `grind-frontend`, **Settings → Secrets and variables → Actions → Variables**, conserver :

- `VITE_GOOGLE_CLIENT_ID` : le Client ID OAuth **Web** existant. Cette valeur publique est déjà ajoutée par le propriétaire du projet.
- `VITE_GRIND_URL` : facultative si l'URL backend par défaut du frontend est correcte.

Ne pas créer une variable `VITE_GOOGLE_CLIENT_SECRET` et ne jamais placer un secret Google dans le frontend.

## 2. Configurer Firebase Cloud Messaging (nécessaire pour les push)

L'APK debug peut être compilé sans Firebase, mais les notifications push distantes ne fonctionneront pas tant que les éléments suivants ne sont pas configurés.

1. Ouvrir la [console Firebase](https://console.firebase.google.com/) et sélectionner/ajouter Firebase au projet Google Cloud de GRIND (`grind-514316`). Éviter de créer un projet séparé si Firebase peut être activé sur le projet GRIND existant.
2. Dans l'aperçu du projet Firebase, ajouter une application **Android** dont le nom de package est exactement `com.gsociety.grind`.
3. Télécharger le fichier `google-services.json` fourni pour cette application Android.
4. Dans le dépôt GitHub `grind-frontend`, ouvrir **Settings → Secrets and variables → Actions → Secrets → New repository secret** :
   - **Name** : `GOOGLE_SERVICES_JSON`
   - **Secret** : le contenu complet du fichier `google-services.json`.
5. Dans les paramètres Firebase du projet, section **Service accounts**, générer une nouvelle clé privée pour un compte de service autorisé à envoyer des messages Firebase Cloud Messaging (API FCM HTTP v1). Activer l'API Firebase Cloud Messaging si elle ne l'est pas.
6. Dans Render, ouvrir le service backend GRIND et ajouter une variable d'environnement :
   - **Name** : `GRIND_FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value** : le contenu JSON complet du fichier de compte de service généré à l'étape précédente.
7. Redéployer le backend Render après avoir enregistré cette variable.

**Sécurité :** `GOOGLE_SERVICES_JSON` reste un Secret GitHub. `GRIND_FIREBASE_SERVICE_ACCOUNT_JSON` reste exclusivement dans les variables privées du backend Render. Ne committer aucun de ces fichiers ou contenus dans GitHub, ne les placer dans une variable `VITE_*` et ne les envoyer dans une conversation.

Le workflow copie le secret `GOOGLE_SERVICES_JSON` dans `android/app/google-services.json` uniquement pendant le build. Si le secret est absent, il émet un avertissement et continue la compilation, mais FCM reste inactif.

## 3. Envoyer les deux dépôts

Les archives 2.8.6 sont séparées :

- `GRIND_BACKEND_PHASE_2_8_6.zip` → contenu du dépôt `grind`.
- `GRIND_FRONTEND_PHASE_2_8_6.zip` → contenu du dépôt `grind-frontend`.

Extraire chaque archive et envoyer le contenu de son dossier à la racine du dépôt correspondant, branche `main`. Ne pas envoyer le ZIP lui-même. Ne pas écraser les variables d'environnement Render existantes.

Déployer ensuite le backend `grind` sur Render. Il ajoute la table `grind_push_tokens` au démarrage via `Base.metadata.create_all` ; il ne réinitialise pas la base existante.

## 4. Lancer la compilation

Dans GitHub → dépôt `grind-frontend` → **Actions** :

1. Sélectionner **Build GRIND Android APK**.
2. Appuyer sur **Run workflow** sur la branche `main`.
3. Attendre que l'exécution soit verte.
4. Ouvrir cette exécution, descendre à **Artifacts** et télécharger `GRIND-Android-Debug`.
5. Extraire l'archive : elle contient `app-debug.apk` et `android-debug-sha1.txt`.

Le workflow accepte les licences SDK Android sans invite interactive, puis installe la plateforme Android et compile l'APK debug.

## 5. Activer Google Sign-In natif

Après la première compilation :

1. Ouvrir `android-debug-sha1.txt` dans l'artifact et copier le SHA-1.
2. Dans Google Cloud Console → projet `grind-514316` → Identifiants, créer un **ID client OAuth Android**.
3. Utiliser le package `com.gsociety.grind` et le SHA-1 du fichier.
4. Garder le Client ID Web existant dans `VITE_GOOGLE_CLIENT_ID` et dans `GOOGLE_CLIENT_ID` côté backend.

Le SHA-1 est lié au keystore debug stable du workflow. Si le cache du keystore est supprimé, il faudra vérifier le nouveau SHA-1. Une version release devra utiliser un keystore distinct.

## 6. Vérifications sur téléphone

Installer l'APK debug sur un appareil Android et tester :

- connexion par e-mail/mot de passe et Google ;
- entrée/sortie de `SalleClasse` et rotation paysage ;
- microphone, caméra et LiveKit ;
- fichiers, aperçus et téléchargements ;
- discussion de groupe, mentions et bouton `@` ;
- réception d'une notification FCM application ouverte, en arrière-plan et fermée ;
- clic sur les notifications pour ouvrir la ressource correspondante.

La livraison source a passé les tests backend et contrôles statiques détaillés dans la note de livraison. Le build GitHub, l'authentification réelle Google, FCM, LiveKit et le test physique restent à effectuer après l'envoi des archives.
