# GRIND 2.8.5 — APK Android avec Capacitor

## Ce qui change

- Le frontend React existant est conservé. Capacitor l'embarque dans une application Android ; l'interface reste une WebView avec un pont vers les fonctions natives Android.
- L'écran de salle LiveKit verrouille le téléphone en paysage uniquement pendant l'ouverture de `SalleClasse`. En quittant la salle, l'orientation redevient libre.
- Le bouton `@` de la discussion de groupe est absent lorsqu'il n'y a aucune mention non lue. Il devient un raccourci flottant au-dessus de la zone de saisie lorsqu'au moins une mention est en attente.
- Le site web conserve Google Identity Services. L'APK utilise le sélecteur Google natif et transmet le jeton d'identité au même endpoint backend `/api/compte/google`.
- Les permissions Android caméra et microphone sont déclarées. Capacitor/Android les demande au moment où une fonction les sollicite ; aucune demande n'est déclenchée à l'ouverture de l'application.
- Le service worker PWA reste actif sur le site, mais ne s'enregistre pas dans l'APK.

## Construire l'APK

Le dépôt `grind-frontend` contient maintenant `.github/workflows/android-apk.yml`.

1. Envoyer le contenu de cette archive dans le dépôt GitHub `grind-frontend`, branche `main`.
2. Dans GitHub, ouvrir **Settings → Secrets and variables → Actions → Variables** et créer :
   - `VITE_GOOGLE_CLIENT_ID` : l'ID client OAuth **Web** déjà utilisé par le frontend et correspondant à `GOOGLE_CLIENT_ID` du backend. Cette valeur est un identifiant public, pas un secret privé.
   - `VITE_GRIND_URL` : facultatif ; si absent, le frontend conserve son URL API par défaut actuelle.
3. Ouvrir l'onglet **Actions**, sélectionner **Build GRIND Android APK**, puis lancer **Run workflow**. Un push sur `main` déclenche aussi le workflow.
4. À la fin, ouvrir le run réussi et télécharger l'artifact **GRIND-Android-Debug**. Il contient `app-debug.apk` et `android-debug-sha1.txt`.

Le workflow construit un APK **debug de test**. Il ne s'agit pas encore d'un APK signé de production pour une publication sur une boutique.

## Activer Google dans l'APK

Le flux Google natif exige deux clients OAuth dans le même projet Google Cloud : le client Web existant et un client Android.

1. Lancer une première compilation GitHub.
2. Ouvrir `android-debug-sha1.txt` dans l'artifact et copier la valeur SHA-1.
3. Dans Google Cloud Console → APIs et services → Identifiants, créer un **ID client OAuth Android** avec :
   - Nom du package : `com.gsociety.grind`
   - Empreinte SHA-1 : celle du fichier `android-debug-sha1.txt`.
4. Conserver le client OAuth Web existant dans `VITE_GOOGLE_CLIENT_ID` et dans `GOOGLE_CLIENT_ID` côté backend.

Le workflow conserve le keystore debug dans le cache GitHub pour stabiliser le SHA-1 entre les compilations ordinaires du dépôt. Si le cache est supprimé/expiré, il faudra enregistrer le nouveau SHA-1 dans Google Cloud. Une future version de production devra utiliser sa propre clé de signature privée et son propre client OAuth Android.

## Backend et CORS

Le backend ajoute explicitement `https://localhost` à sa liste CORS : c'est l'origine locale utilisée par le WebView Android Capacitor. Envoyer également le dossier `grind` modifié sur GitHub et redéployer le backend Render. Ne remplace surtout pas cette origine par `*`.

## Permissions et tests réels nécessaires

- Tester sur un téléphone Android l'entrée/sortie de la salle LiveKit, le micro, la caméra, les pièces jointes et les téléchargements.
- Les flux LiveKit/WebRTC doivent être testés sur appareil physique : le bridge Capacitor gère les demandes de permission WebView, mais cela ne remplace pas un test de communication réel.
- Les notifications push distantes ne sont pas activées par cette étape : elles nécessitent une configuration Firebase/FCM distincte.
- La compilation GitHub n'a pas été exécutée depuis cet environnement de préparation. Elle se lancera après l'envoi des fichiers sur GitHub ; le résultat et les éventuelles erreurs apparaîtront dans Actions.

## Pourquoi l'APK n'est pas une réécriture Kotlin

Capacitor fournit un conteneur Android et des plugins natifs tout en gardant les écrans React existants. Ce n'est pas une interface entièrement réécrite en Kotlin ; les fonctions natives passent par les plugins Capacitor.
