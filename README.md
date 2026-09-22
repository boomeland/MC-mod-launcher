# boomLauncher

Un launcher Minecraft Java fait maison, pour remplacer le launcher officiel. Le but final : lancer du Minecraft **moddé (Forge en priorité)**.

> État actuel : instances (Vanilla / Forge / NeoForge / Fabric, dossier de jeu séparé), **gestion des mods** (Modrinth, .jar locaux, mises à jour) et **modpacks Modrinth et FTB**, testés en jeu (Forge 1.20.1 et 1.12.2, NeoForge 1.21.1, FTB Ultimate Anniversary, Fabulously Optimized). L'auth Microsoft marche jusqu'à l'étape finale et attend l'approbation de Mojang.

## Télécharger

| Windows 10 / 11 (64 bits) | |
|---|---|
| [**⬇ Installeur** (boomLauncher-Setup.exe)](https://github.com/boomeland/MC-mod-launcher/releases/latest/download/boomLauncher-Setup.exe) | Installation classique : raccourcis, désinstallation depuis Windows. |
| [**⬇ Version portable** (boomLauncher-Portable.exe)](https://github.com/boomeland/MC-mod-launcher/releases/latest/download/boomLauncher-Portable.exe) | Un seul fichier, à lancer sans installation. |

Toutes les versions : [page des releases](https://github.com/boomeland/MC-mod-launcher/releases).

> Les exécutables ne sont pas signés : au premier lancement, Windows affiche « Windows a protégé votre ordinateur ». Cliquer sur **Informations complémentaires**, puis **Exécuter quand même**. Java n'a pas besoin d'être installé : le launcher télécharge le bon runtime lui-même.

## Technos utilisées

| Techno | Rôle |
|---|---|
| **Electron** | Application de bureau (fenêtre + accès au système) |
| **TypeScript** | Tout le code, côté launcher et côté interface |
| **electron-vite** (Vite) | Build et rechargement à chaud en dev |
| **adm-zip** | Extraction des librairies natives (anciennes versions de Minecraft) |
| **tsx** | Exécution directe des scripts TypeScript (CLI de test) |
| `fetch` de Node | Tous les appels réseau (pas de dépendance HTTP en plus) |

Les API externes utilisées :
- **Mojang** : liste des versions, librairies, assets, runtimes Java.
- **Microsoft / Xbox / Minecraft Services** : connexion au compte.
- **Maven Forge / NeoForge, meta Fabric** : versions et installation des loaders.
- **FTB** (`api.feed-the-beast.com`) : catalogue et fichiers des modpacks.
- **Modrinth** (`api.modrinth.com`, sans clé) : mods et modpacks (`.mrpack`).

## Lancer le projet

```bash
npm install
cp .env.example .env    # puis renseigner MAIN_VITE_MSA_CLIENT_ID (voir "Connexion Microsoft")
npm run dev             # app Electron en mode dev
npm run build           # compile dans out/
npm run typecheck       # vérification TypeScript
npm test                # tests automatisés (node:test via tsx)
npm run dist            # .exe Windows dans dist/ : installeur + version portable (electron-builder)
npm run cli -- 1.20.1 [pseudo] [--forge[=v] | --neoforge[=v] | --fabric[=v]] [--instance=nom] [--dry]   # teste le cœur sans interface
npm run cli -- ftb:93 --instance=nom [--dry]   # installe (et lance) un modpack FTB par son id
npm run cli -- mr:fabulously-optimized --instance=nom [--dry]   # idem pour un modpack Modrinth (id ou slug)
```

Avec `--dry`, le CLI installe la version et affiche seulement la commande de lancement. Ses données vont dans `.cli-data/` (ignoré par git).

> **Piège :** si l'app plante avec `Cannot read properties of undefined (reading 'getPath')`, la variable d'environnement `ELECTRON_RUN_AS_NODE` est définie (c'est le cas dans un terminal VS Code ou Claude Code). Fais `unset ELECTRON_RUN_AS_NODE` avant `npm run dev`.

## Comment ça marche

Lancer Minecraft, c'est construire une ligne de commande Java. Le launcher prépare tout ce qu'elle référence, puis la lance.

```
Choix de la version
  → 1. Lecture du JSON de la version (Mojang)
  → 2. Téléchargement : client.jar, librairies, assets, Java
  → 3. Authentification (Microsoft ou hors-ligne)
  → 4. Construction de la commande Java et lancement
  → 5. Logs du jeu affichés dans l'app
```

1. **JSON de version.** Mojang publie, pour chaque version, un JSON qui liste les librairies, les assets, la classe principale et les arguments. C'est la source de vérité.
2. **Téléchargement.** Chaque fichier est vérifié par son SHA1 et ignoré s'il est déjà présent. Les téléchargements se font en parallèle. Java est le runtime officiel de Mojang, la bonne version étant choisie selon Minecraft (Java 21 pour la 1.21, par exemple), donc le Java installé sur la machine n'est pas utilisé.
3. **Authentification.** Voir la section suivante.
4. **Lancement.** Le launcher assemble le classpath (librairies et client.jar), remplace les variables du JSON (`${auth_player_name}`, `${assets_root}`…) et lance `java` en processus enfant. Ses sorties sont renvoyées à l'interface.

### Forge

Forge ne remplace pas Minecraft : il s'installe *par-dessus*. Le launcher :

1. installe d'abord le vanilla (et son Java Mojang) ;
2. télécharge l'**installer officiel** de Forge depuis `maven.minecraftforge.net` et le lance en mode headless (`--installClient`) avec ce Java. C'est lui qui patche le jeu (« processors ») et crée `versions/<mc>-forge-<x>/` ;
3. lance cette nouvelle version.

Le JSON de Forge déclare `inheritsFrom: "1.20.1"` : le launcher le fusionne avec celui du vanilla (librairies, arguments). Deux détails importants :
- Le jar vanilla est **copié** sous le nom de la version lancée (`<id>/<id>.jar`), car Forge l'ignore par ce nom via `-DignoreList`. Sans ça, le jeu plante au démarrage (conflit de modules Java).
- Les librairies à URL vide (générées par l'installer) ne sont pas téléchargées.

Les versions Forge proposées viennent de `maven-metadata.xml` et de `promotions_slim.json` (versions recommandée / dernière). Un fichier `.installed-by-launcher` marque une installation terminée, ce qui évite de relancer l'installer.

### NeoForge

NeoForge est un fork de Forge : **même installer, même mécanisme** (installer headless, version qui hérite du vanilla, copie du jar). Seuls changent le Maven (`maven.neoforged.net`) et le versionnage :

| Minecraft | NeoForge |
|---|---|
| 1.21.1 | `21.1.x` (le « 1. » initial disparaît) |
| 1.21 | `21.0.x` |
| 26.1 / 26.1.2 (versionnage par année de Mojang) | `26.1.0.x` / `26.1.2.x` |

NeoForge ne publie pas de versions « recommandées » : le launcher recommande la plus récente hors bêta. Le `maven-metadata.xml` n'étant pas trié, le launcher trie lui-même les versions.

NeoForge pour **1.20.1** (juste après le fork) est publié sous l'ancien artefact `net/neoforged/forge`, avec des versions à la Forge (`1.20.1-47.1.84`). 9 de ces numéros existent aussi chez Forge, avec le même nom d'installer et le même dossier de version pour un contenu différent : ils sont écartés, sinon une instance Forge et une instance NeoForge se partageraient ce dossier.

### Fabric

Pas d'installer : l'API `meta.fabricmc.net` fournit directement un JSON de version qui hérite du vanilla. Le launcher l'écrit dans `versions/fabric-loader-<v>-<mc>/`, puis tout se passe comme pour une version modée classique.

Dans le code, Forge, NeoForge et Fabric implémentent la même interface `Loader` (`listVersions`, `install`) : l'IPC et le CLI ne connaissent que cette interface.

### Modpacks (Modrinth et FTB)

La page « Modpacks » a deux sources, **Modrinth** (recherche paginée dans ~18 000 packs) et **FTB** (catalogue de ~100 packs), filtrables par loader. Choisir un pack, sa version et la RAM crée une instance et y installe le pack. L'instance garde l'icône et l'image du pack (tuile et bannière).

Dans le code, les deux sources implémentent la même interface `ModpackSource` (`search`, `getPack`, `prepare`) : `prepare` lit le pack et résout le loader, puis l'instance est créée, puis `install` pose les fichiers. Ce découpage vient de Modrinth, où la version exacte du loader n'est connue qu'en ouvrant le `.mrpack`.

- **FTB** : pour chaque version, l'API donne Minecraft, le loader et tous les fichiers avec une URL directe et un SHA1 (mods hébergés chez CurseForge compris). La RAM par défaut est celle recommandée par le pack.
- **Modrinth** : un `.mrpack` est un zip avec un index (fichiers à télécharger, versions de Minecraft et du loader) et des dossiers `overrides/` et `client-overrides/` copiés dans le dossier de jeu. Le `.mrpack` est gardé en cache (`minecraft/modpacks/`). Modrinth ne publie pas de RAM recommandée : 4 Go par défaut.
- La version du loader donnée par le pack (`47.4.20`) est retrouvée dans la liste du loader (`1.20.1-47.4.20`).
- **Sécurité :** chemins de fichiers, entrées de l'archive (*zip slip*) et hôtes de téléchargement viennent d'un serveur distant. Un chemin qui sortirait du dossier de l'instance, ou un hôte hors de la liste autorisée par la spécification `.mrpack`, fait échouer toute l'installation (couvert par les tests).
- Si l'installation échoue, l'instance à moitié remplie est supprimée.
- **Non pris en charge :** Minecraft ≤ 1.9 (assets « legacy », et avant 1.6 pas d'installer Forge) et Quilt. Ces packs apparaissent grisés.

### Mods

Onglet **Mods** d'une instance avec loader (masqué pour Vanilla) :

- liste des `.jar` de `mods/`, avec le **nom et l'icône Modrinth** quand le fichier y est reconnu (par SHA1, même s'il a été ajouté à la main) ;
- **activer / désactiver** (renommage en `.jar.disabled`, la convention des launchers), **supprimer** ;
- **ajouter des `.jar`** par le bouton (sélecteur de fichiers) ou par **glisser-déposer** ;
- **rechercher sur Modrinth**, filtré sur le loader et la version de Minecraft de l'instance, et installer en un clic avec les **dépendances obligatoires** (ex. Sodium Extra → Fabric API et Sodium) ;
- **mises à jour** : Modrinth indique la dernière version compatible de chaque fichier. Un mod installé en version stable ne se voit pas proposer une bêta.

Rien n'est mémorisé à part : l'état vient du dossier `mods/` lui-même. Les modifications sont bloquées pendant qu'un jeu tourne (fichiers verrouillés sous Windows). Une instance NeoForge 1.20.1 accepte aussi les mods Forge.

### Interface

- **Barre latérale** : navigation (Bibliothèque, Modpacks), liste des instances avec leur tuile, compte en bas (pseudo hors-ligne ou Microsoft).
- **Vue instance** : bannière (image du pack, ou halo à la couleur du loader), bouton Jouer qui porte l'état de la partie (Préparation…, En jeu), onglets Console, Mods et Réglages (nom, **version de Minecraft et du loader**, mémoire, **arguments JVM**, suppression).
- **Barre d'état** en bas : étape en cours et progression des téléchargements, quelle que soit la page.
- Thème sombre défini par des variables CSS (`:root` de `style.css`), une couleur par loader.

### Exécutable Windows

`npm run dist` compile l'app puis la package avec **electron-builder** (config : champ `build` de `package.json`) :

- `dist/boomLauncher-Setup.exe` : installeur (choix du dossier, raccourcis, désinstallation) ;
- `dist/boomLauncher-Portable.exe` : se lance sans installation (démarrage un peu plus lent : il se décompresse à chaque lancement).

L'icône vient de `build/icon.png` (512 px, convertie en `.ico` par electron-builder). Le `client_id` Microsoft de `.env` est intégré au build : ce n'est pas un secret (client public, device code flow). L'app packagée garde ses données dans `%APPDATA%\mc-mod-launcher\`, comme en dev, et retrouve donc les instances et les fichiers déjà téléchargés.

**Publier une nouvelle version** : c'est automatique via GitHub Actions (`.github/workflows/release.yml`).

```bash
# 1. monter "version" dans package.json (ex. 0.2.0), commiter, pousser
git tag v0.2.0 && git push origin v0.2.0
```

GitHub vérifie que le tag correspond à `package.json`, lance typecheck et tests, compile les deux `.exe` sur une machine Windows, puis crée la release : les liens « Télécharger » du README pointent aussitôt dessus. Un tag avec suffixe (`v0.2.0-test.1`) produit une **pré-release**, ignorée par ces liens, pour tester. Le `client_id` Microsoft vient du secret de dépôt `MSA_CLIENT_ID`.

**Mise à jour automatique** (version installée, depuis la 0.3.0) : au démarrage, le launcher lit `latest.yml` sur la dernière release GitHub (electron-updater). Si une version plus récente existe, il la télécharge en arrière-plan (téléchargement différentiel grâce au `.blockmap`), vérifie son SHA-512 et affiche une carte « Version X prête — Redémarrer » dans la barre latérale ; sans clic, elle s'installe à la fermeture. La version portable ne peut pas se remplacer elle-même : elle affiche seulement un lien vers la release. Le redémarrage est refusé pendant une partie. Sans signature de code, la confiance repose sur le compte GitHub qui publie les releases : garder la double authentification activée.

Les exécutables **ne sont pas signés** : au premier lancement, Windows SmartScreen affiche « Windows a protégé votre ordinateur » → « Informations complémentaires » → « Exécuter quand même ».

### Logs du jeu

La config log4j de Mojang, passée au jeu parce qu'elle corrige Log4Shell sur les anciennes versions, écrit la console en XML. Le main la décode en lignes lisibles (`core/log4j.ts`). L'interface regroupe l'affichage par image et ne garde que les 200 000 derniers caractères : un modpack écrit des dizaines de milliers de lignes (le log complet est dans `logs/latest.log` de l'instance).

### Instances

Une **instance** est un profil : une version de Minecraft, un loader (Vanilla, Forge, NeoForge ou Fabric), une quantité de RAM et **son propre dossier de jeu**. Deux instances ne partagent donc ni leurs mods, ni leurs mondes, ni leurs `options.txt`.

```
%APPDATA%/mc-mod-launcher/
├── minecraft/            partagé : versions, librairies, assets, Java, installers Forge/NeoForge
└── instances/
    └── <id>/
        ├── instance.json     nom, version, loader, RAM
        └── minecraft/        dossier de jeu : mods/, saves/, config/, options.txt, logs/
```

- L'`<id>` est un slug du nom (`Mon modpack` → `mon-modpack`, puis `mon-modpack-2` en cas de doublon). Le dossier est réservé par un `mkdir` non récursif, donc sûr même si deux créations arrivent en même temps.
- Au lancement, le launcher passe le dossier de l'instance en `--gameDir` et sa RAM en `-Xmx` ; le reste (jar, librairies, Java) reste partagé, donc rien n'est retéléchargé.
- Pour les mods : « Ouvrir le dossier » ouvre le dossier de jeu de l'instance, il suffit d'y déposer les `.jar` dans `mods/`.
- Les modifications (RAM, suppression) sont bloquées pendant qu'un jeu tourne.
- **Sécurité :** un id d'instance qui n'est pas un slug (`../`, `/`, majuscules…) est refusé avant tout accès disque. C'est important car la suppression est récursive et efface les mondes ; c'est couvert par les tests.

### Connexion Microsoft

Utilise le **device code flow** : l'app affiche un code, tu le saisis sur `microsoft.com/link` dans le navigateur, et l'app est connectée. Pas de mot de passe dans l'app, pas de redirect URI, pas de secret.

```
Code appareil → Token Microsoft → Xbox Live → XSTS → Minecraft Services → profil (pseudo + UUID)
```

- Le **refresh token** est stocké chiffré (`safeStorage` d'Electron, donc DPAPI sous Windows). Il est rafraîchi avant chaque lancement, ce qui évite de se reconnecter.
- Sans compte connecté, on peut jouer en **hors-ligne** avec un pseudo libre (pratique en dev, ou pour les serveurs offline).

**Configuration requise :** il faut une app Azure (gratuite) avec les comptes personnels Microsoft activés et **Allow public client flows**. Son *Application (client) ID* va dans `.env` sous `MAIN_VITE_MSA_CLIENT_ID`. Mojang doit aussi approuver l'app (formulaire *Minecraft API app registration*, `aka.ms/AppRegInfo`), sinon l'étape finale peut renvoyer une erreur 403.

## Architecture du code

```
src/
├── core/        Logique du launcher, sans dépendance à Electron (testable en CLI)
│   ├── version.ts     manifest Mojang + fusion inheritsFrom
│   ├── libraries.ts   choix des librairies selon l'OS/l'architecture
│   ├── rules.ts       règles Mojang (allow/disallow par OS)
│   ├── download.ts    téléchargements (SHA1, reprises, parallélisme)
│   ├── install.ts     installe tout ce qu'il faut pour une version
│   ├── java.ts        télécharge le runtime Java Mojang
│   ├── launch.ts      construit la commande et lance le jeu
│   ├── auth.ts        compte hors-ligne
│   ├── instances.ts   création, liste, modification, suppression des instances
│   ├── loaders/       Loaders de mods
│   │   ├── index.ts       interface Loader + table LOADERS
│   │   ├── forge.ts       versions (maven-metadata + promotions), URL de l'installer
│   │   ├── neoforge.ts    versions (correspondance MC → NeoForge, cas 1.20.1), URL de l'installer
│   │   ├── fabric.ts      versions et JSON de version (meta Fabric, sans installer)
│   │   ├── installer.ts   commun : vanilla → installer officiel en headless → marqueur
│   │   └── maven.ts       lecture d'un maven-metadata.xml
│   ├── modpacks/      Sources de modpacks
│   │   ├── index.ts       interface ModpackSource + table PACK_SOURCES
│   │   ├── common.ts      résolution du loader, hôtes d'images, taille de page
│   │   ├── ftb.ts         catalogue FTB, fichiers du pack
│   │   └── modrinth.ts    recherche, .mrpack (index, overrides, hôtes autorisés)
│   ├── modrinth.ts    client de l'API Modrinth (partagé mods / modpacks)
│   ├── mods.ts        mods locaux : liste, activation, suppression, ajout (noms validés)
│   ├── modrinth-mods.ts  mods Modrinth : recherche, installation avec dépendances, mises à jour
│   ├── log4j.ts       décodage des logs XML du jeu
│   └── msa/           Connexion Microsoft
│       ├── oauth.ts       device code flow, refresh
│       ├── minecraft.ts   Xbox Live → XSTS → Minecraft Services → profil
│       ├── http.ts        POST form / JSON
│       ├── errors.ts      AuthError + messages lisibles (XErr, 403 Mojang)
│       └── index.ts       loginWithDeviceCode(), loginWithRefreshToken()
├── main/        Process principal Electron
│   ├── index.ts       démarrage : enregistre les IPC, ouvre la fenêtre
│   ├── window.ts      création de la fenêtre
│   ├── config.ts      client_id Microsoft (.env), dossiers partagé et des instances
│   ├── accounts.ts    stockage chiffré du refresh token
│   └── ipc/           un fichier par domaine : versions, instances, modpacks, mods, auth, game
├── preload/     Pont sécurisé entre l'interface et le main (window.launcher)
├── renderer/    Interface, un module par zone
│   ├── main.ts        point d'entrée
│   ├── instances.ts   barre latérale des instances ; vue instance (bannière, Console, Réglages)
│   ├── create.ts      boîte « Nouvelle instance » (version, loader et sa version, RAM)
│   ├── discover.ts    page « Modpacks » (sources, recherche, filtres) et fiche d'installation
│   ├── mods.ts        onglet Mods et recherche de mods Modrinth
│   ├── settings.ts    onglet Réglages (nom, version, mémoire, JVM, suppression)
│   ├── version-picker.ts  sélecteur version MC + loader (création et Réglages)
│   ├── account.ts     compte (bas de la barre latérale) : Microsoft / hors-ligne
│   ├── play.ts        bouton Jouer et ses états, progression, logs
│   ├── views.ts       bascule entre les vues (instance, vide, Modpacks)
│   └── status.ts, dom.ts   helpers (barre d'état, console, création d'éléments, tuiles)
└── shared/      Types partagés entre main et renderer
scripts/cli.mts  Lancement en ligne de commande, sans interface
tests/           Tests automatisés (node:test)
```

L'interface n'a aucun accès direct à Node : elle passe uniquement par les fonctions exposées dans [src/shared/api.ts](src/shared/api.ts) (`contextBridge`, sandbox activée, CSP restrictive).

Les données sont dans le dossier `userData` d'Electron (`%APPDATA%/mc-mod-launcher/` sous Windows) : `minecraft/` pour les fichiers partagés, `instances/` pour les instances (voir plus haut).

## Avancement

### Fonctionnel
- [x] Installation et lancement de Minecraft vanilla (testé en 1.21.1 via le CLI)
- [x] Téléchargement automatique du bon Java (runtime Mojang)
- [x] Interface : choix de version (releases et snapshots), pseudo, progression, logs du jeu
- [x] Mode hors-ligne
- [x] Fusion des versions par héritage (`inheritsFrom`)
- [x] **Forge** : installation via l'installer officiel et lancement, testé en 1.20.1 (Java 17, format récent) et 1.12.2 (Java 8, ancien format) via le CLI
- [x] Interface : choix Vanilla / Forge et de la version Forge (recommandée par défaut)
- [x] Auth Microsoft : device code, Xbox Live et XSTS validés contre les vrais serveurs
- [x] **Instances** : création (nom, version, Vanilla/Forge, RAM), liste, modification de la RAM, suppression, ouverture du dossier. Dossier de jeu séparé par instance, vérifié en lancement réel (Forge 1.20.1 : `--gameDir`, `-Xmx` et fichiers dans le dossier de l'instance)
- [x] Interface testée via DevTools : création, sélection, doublons de nom, RAM, suppression
- [x] **NeoForge** : installation et lancement réel testés en 1.21.1 (NeoForge 21.1.251, Java 21) via le CLI ; création d'instance NeoForge testée dans l'interface via DevTools
- [x] **Fabric** : installation testée (`--dry`, 1.20.1)
- [x] **Modpacks FTB** : 62 packs pris en charge sur 94 ; le loader des 62 est résolu sans échec. FTB Ultimate Anniversary (1.16.5, Forge) installé et lancé à 2 Go, via le CLI et via l'interface
- [x] Bouton « Jouer » depuis l'interface Electron (jeu lancé, logs affichés, fin de partie détectée)
- [x] Tests automatisés (40 tests) : instances (dont changement de version et arguments JVM), mods locaux (noms reçus par IPC), versions NeoForge, fichiers FTB et `.mrpack` (chemins, hôtes, zip slip), décodage des logs
- [x] **Gestion des mods** (onglet Mods) : liste avec noms et icônes Modrinth, activer / désactiver, supprimer, ajouter des `.jar` (bouton et glisser-déposer), recherche Modrinth avec dépendances, mises à jour. Vérifié en jeu : JEI installé depuis l'interface et chargé par NeoForge 1.21.1
- [x] **Modpacks Modrinth** : recherche, installation, lancement. Vérifié en jeu : Fabulously Optimized 6.5.0 (Fabric 1.21.1, 151 mods chargés) installé et lancé depuis l'interface
- [x] **Mise à jour automatique** du launcher installé (electron-updater + releases GitHub). Vérifiée de bout en bout : une 0.2.99 installée a trouvé la release 0.3.0, l'a téléchargée, installée en silence et s'est relancée en 0.3.0
- [x] **Instances** : renommer, changer la version de Minecraft et du loader, arguments JVM (vérifiés sur la ligne de commande Java, guillemets compris)
- [x] **Exécutable Windows** (installeur + portable, icône) : l'app packagée démarre, appelle le main et lit les données au même endroit qu'en dev

### Codé mais non testé
- [ ] Auth Microsoft, étape finale `login_with_xbox` (403 tant que Mojang n'a pas approuvé l'app Azure)
- [ ] Reconnexion automatique après redémarrage (refresh token)
- [ ] Bouton « Ouvrir le dossier » (ouvre l'explorateur, non exercé par le test automatisé)

### À faire
- [ ] Modpacks : CurseForge (clé API requise), import d'un `.mrpack` local, mise à jour d'un pack installé
- [ ] FTB : packs 1.6.4 / 1.7.10 (assets legacy), puis 1.4.7 / 1.5.2 (pas d'installer Forge)
- [ ] Quilt
- [ ] Instances : dupliquer, liste des mondes et captures d'écran
- [ ] Gestion de plusieurs comptes
- [ ] Signature de code des `.exe` (certificat)
- [ ] Tests automatisés du reste du cœur (règles, résolution des librairies, fusion des versions)

### Limites connues
- Versions ≤ 1.7.2 : assets « legacy » (`virtual` / `map_to_resources`) non gérés.
- Un seul compte à la fois, une seule partie à la fois.
- Les données créées avant les instances, dans l'ancien dossier de jeu unique, ne sont pas importées dans une instance.
- Pas de gestion des « features » du JSON Mojang (mode démo, résolution personnalisée).

## Légal

Le launcher exige un vrai compte Minecraft Java pour l'auth Microsoft. Il ne redistribue aucun fichier de Mojang : tout est téléchargé depuis leurs serveurs.
