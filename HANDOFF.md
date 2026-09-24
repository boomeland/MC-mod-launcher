# Handoff — état du projet au 24/09/2026

Fichier de reprise pour une nouvelle session. Il contient **uniquement ce qui périme** : état git, travail récent, décisions déjà prises, questions ouvertes.

Ne pas y chercher le fonctionnement du launcher (→ `README.md`) ni les règles de travail et les pièges (→ `CLAUDE.md`). **Lire ces deux fichiers d'abord.**

> Ce fichier est un instantané, pas une source de vérité. S'il date de plus de quelques jours, vérifier avec `git log`, `git status` et `npm test` avant de s'y fier.

## 1. État git

- La v0.3.3 (§2) est poussée sur `dev` et publiée, mais pas encore dans `main` (**PR `dev` → `main` à faire** par l'utilisateur). Le diagnostic de crash (§2) est **non commité**.
- Dernière release publiée : **`v0.3.3`** (24/09). L'installation de l'utilisateur (`K:JeuxMC Mod Launcher`) se met à jour seule depuis les releases GitHub.
- Dépôt renommé **`boomeland/boomLauncher`** : GitHub redirige (301) l'ancien nom, les installations antérieures trouvent donc les nouvelles versions.

| Release | Contenu |
|---|---|
| `v0.1.0` | Vanilla, Forge, NeoForge, Fabric, instances, modpacks FTB, exécutable Windows |
| `v0.2.0` | Mods (onglet Mods), modpacks Modrinth, réglages d'instance |
| `v0.3.0` | Mise à jour automatique (electron-updater) |
| `v0.3.1` | Renommage en **boomLauncher** (après le refus de Mojang) |
| `v0.3.2` | Hors-ligne réservé aux possesseurs du jeu, messages d'erreur lisibles |
| `v0.3.3` | Bouton « Arrêter », délai réseau de 30 s, titre « boomLauncher » des boîtes natives |

## 2. Travail du 24/09

Les trois premières améliorations de la liste proposée à l'utilisateur (la suite est au §6).

### Diagnostic de crash (**non commité**)

- `core/crash.ts` (`diagnoseCrash`, `findCrashReport`, `explainCrash`) ; `main/ipc/game.ts` garde les 500 dernières lignes de la console, diagnostique sur `'close'` (pas `'exit'`, qui peut précéder les dernières lignes) et envoie `game:exit` = `{ code, crash }`. IPC `game:open-crash-report` sans argument (chemin gardé dans le main). Encadré rouge au-dessus de la console.
- **Crashs réels provoqués au labo** (script jetable dans le scratchpad, sur le dossier partagé) — ils ont changé le plan :
  - vanilla `-Xmx64M` : code 1, **aucun rapport**, cause seulement dans la console ; `-Xmx200M` : écran « Out of memory », **le jeu reste ouvert** ;
  - Fabric + Sodium Extra sans Sodium : fenêtre d'erreur Fabric, pas de rapport, solution calculée dans la console ; fermer la fenêtre → code 1 ;
  - NeoForge 21.1.248 + REI sans Architectury / Cloth Config : écran d'erreur (reste ouvert) + `crash-reports/crash-…-fml.txt` avec des lignes `Failure message:` ;
  - `-XX:+CrashOnOutOfMemoryError` : `hs_err_pid*.log` dans le dossier de jeu.
  - D'où : diagnostic à **chaque** fin de partie, quel que soit le code ; seules ces causes-là sont reconnues (`UnsupportedClassVersionError` et crash de pilote écartés faute de cas réel).
- Textes réels anonymisés dans `tests/fixtures/crash/`, 8 tests dans `tests/crash.test.mts`.
- Vérifié dans l'app (profil isolé) : NeoForge arrêté depuis l'écran d'erreur → cause + « Ouvrir le rapport » (ouvre le `.txt` dans l'éditeur par défaut) ; Fabric fenêtre fermée → solution Fabric, bouton masqué ; vanilla fermé normalement → aucun encadré.
  - Piège de test : l'éditeur `.txt` de l'utilisateur est **Notepad++**, pas le Bloc-notes. Ne pas fermer l'éditeur ouvert par le test sans avoir vérifié qu'il ne tournait pas déjà.
- Non vérifié : le format `Failure message` de **Forge** (même regex, format supposé identique à NeoForge) ; un crash en pleine partie avec rapport vanilla (repli « Description », testé seulement en unitaire).
- Santé : typecheck OK, **50/50**, build OK.

### Publié en v0.3.3

- **Bouton « Arrêter »** : en jeu, le bouton Jouer devient « Arrêter » (rouge discret). IPC `game:stop` → boîte native de confirmation dans le main (même raison que `instances:delete`) → `kill()` du process gardé par `main/ipc/game.ts`. Barre d'état : « Jeu arrêté » (code de sortie `null`).
  - Vérifié dans l'app compilée (profil isolé, vanilla 1.21.1 à 2 Go), boîte pilotée par UI Automation : « Annuler » laisse le jeu tourner ; « Forcer l'arrêt » tue le PID, plus aucun `javaw` du profil, bouton revenu à « Jouer ».
  - Astuce de test : les boutons de la boîte sont des `CCPushButton` sans `InvokePattern`, et la fenêtre de Minecraft passe devant. Il faut mettre la boîte au premier plan, puis cliquer à la souris au centre du bouton.
- **Délai réseau** : `withTimeout()` de `core/download.ts`, utilisé par tous les `fetch` du cœur (JSON, fichiers, Maven, auth Microsoft). Abandon après 30 s sans signe de vie ; pour un fichier, le délai repart à chaque morceau reçu. Message : « pas de réponse de <hôte> depuis 30 s ».
  - `tests/download.test.mts` : serveur local + horloges simulées (serveur muet coupé ; téléchargement de 72 s avec des données toutes les 24 s non coupé). Vérifié que le second test échoue si le délai n'est pas relancé.
- Santé : typecheck OK, **42/42**, build OK.

## 3. Travail du 22/09 (commité, publié)

### Refus de Mojang et renommage

- Mojang a **refusé** la première demande d'accès à l'API sous le nom « MC Mod Launcher ». Le launcher s'appelle maintenant **boomLauncher** (fenêtre, installation Windows, fichiers de release, marque transmise au jeu, user-agent).
- `name` npm (`mc-mod-launcher`) et `build.appId` **inchangés** (dossier de données et identité de l'installation, voir `CLAUDE.md`).
- Mise à jour 0.3.0 → 0.3.1 vérifiée sur l'installation réelle via un serveur local : une seule entrée dans les programmes installés, raccourci mis à jour, données conservées.
- Pour la nouvelle demande : `PRIVACY.md` (scopes, refresh token chiffré, services contactés, aucune télémétrie) et présentation en anglais dans le `README.md`.

### Hors-ligne réservé aux possesseurs du jeu (`f688671`)

- Un launcher qui fait jouer sans compte ressemble à un launcher cracké : motif classique de refus. Comme le launcher officiel, le hors-ligne ne se débloque qu'après **une connexion Microsoft réussie** (marque `owner-verified` dans `userData`, qui survit à la déconnexion ; falsifiable, c'est assumé et commenté dans `main/accounts.ts`).
- Le refus est fait **dans le main** (`game:play`, IPC non fiable) ; le renderer grise seulement le champ. **En dev, le hors-ligne reste ouvert** (`!app.isPackaged`).
- Le compte est résolu **avant** les téléchargements : un joueur refusé ne télécharge plus des centaines de Mo pour rien.
- Vérifié dans l'exe packagé avec un profil isolé : sans marque, lancement refusé avant tout téléchargement ; avec la marque, lancement autorisé.
- **Conséquence** : tant que Mojang n'a pas approuvé l'app, l'exe publié n'est jouable que par qui crée la marque à la main. On teste en dev ou via le CLI.

### Messages d'erreur (`47de591`)

`errorText()` de `renderer/status.ts` retire le préfixe « Error invoking remote method '…': Error: » des rejets IPC (14 messages du renderer).

## 4. Ce qui marche, ce qui bloque

- **Lancé en réel** : vanilla 1.21.1, Forge 1.20.1 (Java 17) et 1.12.2 (Java 8), NeoForge 21.1.251 (1.21.1), FTB Ultimate Anniversary (Forge 1.16.5), Fabulously Optimized (Fabric 1.21.1, 151 mods), JEI installé depuis l'UI et chargé par NeoForge.
- **Auth Microsoft : bloquée côté Mojang, pas côté code.** Device code, Xbox Live et XSTS passent ; `login_with_xbox` renvoie **403** tant que l'app Azure n'est pas approuvée. Ne pas « débugger » ce 403. Non testable en attendant : la reconnexion par refresh token et le déblocage réel du hors-ligne par une vraie connexion.
- **Non vérifié** :
  - le bouton « Ouvrir le dossier » ;
  - un vrai glisser-déposer depuis l'Explorateur (le même appel IPC est testé avec un chemin) ;
  - le lancement réel d'un pack Fabric ou NeoForge 1.20.1 (installation seulement) ;
  - la carte « disponible » de la version portable ;
  - la mise à jour d'un mod pendant qu'un jeu tourne (bloquée par l'UI, non forcée).
- `.cli-data/` a été vidé : le premier `npm run cli` retélécharge tout.

## 5. Décisions déjà prises (ne pas les re-débattre sans raison)

| Décision | Pourquoi |
|---|---|
| Déléguer Forge / NeoForge à **l'installer officiel en headless** | Réimplémenter les « processors » qui patchent le jar est long et fragile. |
| Le **cœur (`src/core/`) ne dépend pas d'Electron** | Tests en CLI et en `node:test` sans lancer l'app. |
| **Device code flow** plutôt que fenêtre de login | Pas de redirect URI, pas de secret client, pas de navigateur embarqué. |
| **Fichiers partagés** (`userData/minecraft/`) séparés des **instances** | Une instance ne retélécharge ni librairies, ni assets, ni Java. |
| Ids d'instance = **slugs validés** avant tout accès disque | `deleteInstance` fait un `rm -r` sur les mondes du joueur. |
| Pas de framework UI | L'UI reste simple ; React coûterait plus qu'il ne rapporte. |
| **SOLID obligatoire** pour les nouveaux modules majeurs | Tranché le 21/09, borné par la boucle anti-suringénierie (`CLAUDE.md`). |
| **Hors-ligne derrière une connexion réussie** (exe packagé) | Condition d'acceptation par Mojang ; ouvert en dev pour les tests. |
| **Pas de cache de validation des fichiers** au lancement | Mesuré le 24/09 : le SHA1 de toutes les librairies et du JRE (~1 000 fichiers, 430 Mo) coûte 0,3 à 0,9 s, négligeable face au démarrage du jeu. |

## 6. Prochaines étapes proposées (dans l'ordre)

1. **Jouer sans Internet** : chaque lancement exige le réseau même quand tout est installé (`ensureJava` relit l'index Java de Mojang, le compte Microsoft rafraîchit son token). Garder l'index sur disque ; sans réseau, lancer en hors-ligne avec le pseudo et l'UUID enregistrés.
2. **Mise à jour d'un modpack installé** (sans perdre mondes et réglages).
3. **Dupliquer une instance / sauvegarder ses mondes** (avant de changer de version : une rétrogradation peut corrompre un monde).
4. **CurseForge** (clé API Overwolf).

**À examiner** (vu en récoltant les crashs) : sous NeoForge 21.1.248, la console affiche `WARN StatusConsoleListener Error parsing URI …\assets\log_configs\client-1.12.xml`. Le chemin Windows passé à `-Dlog4j.configurationFile` n'est pas une URI valide pour ce log4j : vérifier si la config de Mojang (correctif Log4Shell) est réellement appliquée sous NeoForge, et si elle l'est pour les autres loaders.

## 7. Questions en attente pour l'utilisateur

1. **Passe de commentaires de réflexion** sur le code déjà écrit (il explique souvent le *quoi*, pas toujours le *pourquoi*) : à faire ou non ?
2. **Nouvelle demande d'accès à Mojang** : envoyée sous le nom boomLauncher ? (délai inconnu ; rien à faire côté code en attendant)

## 8. Santé au 24/09

```
npm run typecheck  → OK
npm test           → 50/50
npm run build      → OK
```

## 9. Reprendre en 3 commandes

```bash
git status
npm run typecheck && npm test && npm run build
unset ELECTRON_RUN_AS_NODE && npm run dev    # sinon Electron démarre comme un simple Node
```
