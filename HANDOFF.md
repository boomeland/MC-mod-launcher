# Handoff — état du projet au 21/09/2026

Fichier de reprise pour une nouvelle session. Il contient **uniquement ce qui périme** : état git, travail en cours non commité, décisions déjà prises, questions ouvertes.

Ne pas y chercher le fonctionnement du launcher (→ `README.md`) ni les règles de travail et les pièges (→ `CLAUDE.md`). **Lire ces deux fichiers d'abord.**

> Ce fichier est un instantané, pas une source de vérité. S'il date de plus de quelques jours, vérifier avec `git log`, `git status` et `npm test` avant de s'y fier.

## 1. État git

Tout le travail décrit ci-dessous est **commité et poussé sur `origin/dev`** (3 commits au-dessus de `cc0d1f4`). Prochaine étape côté utilisateur : PR `dev` → `main` sur GitHub.

Historique utile :

| Commit | Contenu |
|---|---|
| *(3 commits du 21/09)* | Code (instances, loaders, FTB, interface) · exécutable Windows · documentation |
| `e4659b2` | Refactoring : découpage des gros fichiers (`msa/`, `ipc/`, modules renderer) |
| `248b7e1` | Support de Forge + correction de la fenêtre du jeu cachée |
| `028e519` | Auth Microsoft (device code) + README détaillé |
| `86176e9` | Launcher vanilla : installation et lancement |

## 2. Travail de la session du 21/09 (commité)

### Les instances (fonctionnalité complète)

Un profil = une version MC + un loader + son propre dossier de jeu + sa RAM.

Fichiers **nouveaux** : `src/core/instances.ts`, `src/main/ipc/instances.ts`, `src/renderer/instances.ts`, `tests/instances.test.mts`.
Fichier **renommé** : `src/renderer/versions.ts` → `create.ts` (il ne gère plus la sélection globale mais le formulaire de création).
Fichiers **modifiés** : `shared/api.ts` (`PlayOptions` prend maintenant `instanceId` et non plus `mcVersion`/`forgeVersion`), `preload`, `main/config.ts` (+`INSTANCES_DIR`), `main/ipc/game.ts` (lit l'instance, passe `--gameDir` et `-Xmx`), `renderer/{index.html,style.css,main.ts,play.ts}`, `scripts/cli.mts` (+`--instance=`), `package.json` (+script `test`), `tsconfig.json` (+`tests`), `README.md`.

Vérifié :
- **10 tests** sur `core/instances.ts` (slugs, unicité en parallèle, bornes de RAM, refus des chemins type `../`).
- **Interface pilotée via DevTools** (CDP, profil Electron isolé) : création d'une instance Forge, deux instances de même nom, sélection, RAM modifiée puis bornée, suppression, retour à l'état vide. 14 vérifications passées.
- **Lancement réel** Forge 1.20.1 via `npm run cli -- 1.20.1 --forge --instance=…` : `-Xmx3072M`, `--gameDir` correct, fenêtre visible, `mods/ saves/ config/ logs/` créés dans le dossier de l'instance.

Non vérifié :
- ~~Le bouton « Jouer » cliqué depuis l'app~~ : vérifié depuis (modpack FTB, voir plus bas).
- Le bouton **« Ouvrir le dossier »** (non cliqué pour ne pas ouvrir l'explorateur).

### NeoForge (par-dessus les instances)

- `src/core/forge/` → `src/core/loaders/` : interface `Loader` (`listVersions`, `install`) dans `index.ts`, implémentée par `forge.ts` et `neoforge.ts` ; `installer.ts` (installer headless commun) et `maven.ts` (lecture du metadata) sont partagés.
- Modèle d'instance : `forgeVersion` → union discriminée `loader` + `loaderVersion` (pas de migration : les instances n'avaient jamais été commitées). Le loader est validé côté main (`isModLoader`) : IPC non fiable.
- IPC `forge:versions` → `loader:versions`. CLI : `--neoforge[=version]`. UI : option NeoForge, sélecteur de version générique.
- `tests/neoforge.test.mts` (correspondance MC → NeoForge, tri, bêtas) + 1 test instance (loader inconnu).
- Vérifié : lancement réel NeoForge 21.1.251 / MC 1.21.1 dans une instance (fenêtre visible, fichiers dans le dossier de l'instance) ; Forge 1.20.1 et 1.12.2 toujours OK (`--dry`) ; UI via CDP 12/12.

### Modpacks FTB + Fabric + NeoForge 1.20.1

- Périmètre choisi par l'utilisateur : phases 1 et 2, soit **62 packs FTB sur 94** (Forge/NeoForge/Fabric, MC ≥ 1.10). Les 32 packs 1.4.7 à 1.7.10 sont affichés « non pris en charge ».
- `core/modpacks/ftb.ts` : catalogue, `resolveFtbLoader` (version FTB courte → Maven), `ftbDownloads` (refuse les chemins hors du dossier de jeu), `installFtbFiles`. Pas d'interface « source » (FTB seule).
- `core/loaders/fabric.ts` (JSON de version depuis meta.fabricmc.net) ; `neoforge.ts` gère 1.20.1 via l'ancien artefact, **en écartant les 9 versions dont les numéros existent aussi chez Forge** (collision de dossier `versions/1.20.1-forge-47.1.x`).
- IPC `ftb:list`, `ftb:install` (ids seulement ; l'instance est supprimée si l'installation échoue). UI : bouton « + Modpack FTB ». CLI : `ftb:<packId> --instance=…`.
- **Bug trouvé en testant « Jouer » depuis l'app** : le renderer montait à 5 Go et se figeait (un ajout au DOM et un recalcul de mise en page par ligne de log). Corrigé : affichage regroupé par image et plafonné, et logs XML log4j décodés dans le main (`core/log4j.ts`). Vérifié : 95 Mo, 0 ligne XML.
- Vérifié : le loader des 62 packs se résout sans échec ; FTB Ultimate Anniversary (id 93, 1.16.5) installé et lancé à 2 Go via le CLI **et via l'interface** (« Jouer » compris) ; Fabric 1.20.1 en `--dry`. 25 tests.
- Non vérifié : lancement réel d'un pack Fabric ou NeoForge 1.20.1 (installation seulement), et d'un gros pack moderne (4 à 8 Go demandés, au-dessus de la limite de test de 2 Go).

### Exécutable Windows

- `electron-builder` (devDependency) ; `npm run dist` → `dist/MC-Mod-Launcher-Setup-0.1.0.exe` (NSIS, choix du dossier) et `dist/MC-Mod-Launcher-0.1.0-portable.exe`, ~106 Mo chacun. Icône : `build/icon.png`, bloc d'herbe isométrique en pixel art (textures 16×16 générées par un script canvas, aucun fichier Mojang), à commiter.
- Vérifié : l'exe démarre, l'IPC répond (liste des versions), aucune donnée ailleurs que dans `%APPDATA%\mc-mod-launcher`, icône présente dans l'exécutable, `client_id` intégré au build.
- Non signé : avertissement SmartScreen au premier lancement. Installeur non exécuté pendant le test (seul l'exe dépaqueté `dist/win-unpacked` a été lancé).

### Refonte de l'interface (style « launcher moderne », choisi par l'utilisateur)

- Barre latérale (navigation, instances avec tuiles, compte), vue instance avec bannière et gros bouton Jouer à états, onglets Console / Réglages (la suppression est dans Réglages), page « Modpacks FTB » en grille de cartes filtrable, barre d'état commune. Fenêtre 1180×760 (min 940×620).
- Données : `FtbPack.art` et `Instance.art` (icône et image du pack, CDN FTB uniquement ; `instances:create` retire `art` venant du renderer). CSP : `img-src` ouvert au seul `cdn.feed-the-beast.com`.
- Vérifié, dans un profil isolé : captures de toutes les vues ; création Fabric, curseur RAM et navigation via CDP (4/4) ; renommage, suppression avec boîte native, puis saisie du pseudo **avec de vraies frappes** ; lancement réel du pack FTB avec les états du bouton (Préparation… → En jeu → Jouer).

### Correctif : clavier coupé après une suppression

Le `confirm()` du bouton Supprimer coupait le clavier dans tous les champs (bug Electron / Windows, signalé par l'utilisateur, reproduit avec `SendKeys`). La confirmation est maintenant une boîte native ouverte par le main dans `instances:delete`, qui renvoie `false` si l'utilisateur annule. Vérifié avec de vraies frappes : annuler, supprimer, puis saisie dans les champs.

### `CLAUDE.md`

Adapte le CLAUDE.md global au projet et se termine par une boucle de vérification de suringénierie.

### Santé au moment du dump

```
npx tsc --noEmit   → OK
npm test           → 25/25
npm run build      → 0 erreur
```

## 3. Ce qui marche, ce qui bloque

- **Vanilla** : installation + lancement. Testé en 1.21.1.
- **Forge** : installation via l'installer officiel headless + lancement. Testé en **1.20.1** (Java 17, format récent) et **1.12.2** (Java 8, ancien format de JSON) — les deux formats de version sont donc couverts.
- **Java** : runtime Mojang téléchargé automatiquement selon la version. Le Java de la machine n'est pas utilisé.
- **Auth Microsoft** : **bloquée côté Mojang, pas côté code.** Le device code, Xbox Live et XSTS passent contre les vrais serveurs ; l'étape finale `login_with_xbox` renvoie **403** tant que l'app Azure n'est pas approuvée (formulaire `aka.ms/AppRegInfo`, envoyé, délai inconnu). Ne pas « débugger » ce 403 : il n'y a rien à corriger. Le `client_id` est dans `.env` (non commité).
  - Corollaire non testable aujourd'hui : la reconnexion automatique par refresh token.
- **Mode hors-ligne** : opérationnel, c'est ce qui sert pour tous les tests.

## 4. Décisions déjà prises (ne pas les re-débattre sans raison)

| Décision | Pourquoi |
|---|---|
| Déléguer l'installation de Forge à **l'installer officiel en headless** | Réimplémenter les « processors » qui patchent le jar est long et fragile ; l'installer fait le travail et suit les évolutions de Forge. |
| Le **cœur (`src/core/`) ne dépend pas d'Electron** | Permet de tester en CLI et en `node:test` sans lancer l'app. C'est ce qui a permis de valider Forge avant d'avoir une UI. |
| **Device code flow** plutôt que fenêtre de login | Pas de redirect URI, pas de secret client, pas de navigateur embarqué à sécuriser. |
| **Fichiers partagés** (`userData/minecraft/`) séparés des **instances** (`userData/instances/`) | Créer une instance ne retélécharge ni les librairies, ni les assets, ni Java. |
| Ids d'instance = **slugs validés** avant tout accès disque | `deleteInstance` fait un `rm -r` sur les mondes du joueur. |
| Pas de framework UI (HTML/CSS/TS à la main) | L'UI est simple ; ajouter React coûterait plus qu'il ne rapporte à ce stade. |

## 5. Prochaine étape proposée

NeoForge, Fabric et FTB (62 packs) sont faits (voir §2). Par ordre de valeur : gestion des mods depuis l'UI, modpacks Modrinth (`.mrpack`, API ouverte : c'est là que naît l'interface « source de modpacks »), puis CurseForge (clé API), FTB legacy (1.6.4/1.7.10 puis 1.4.7/1.5.2), packaging Windows.

## 6. Questions en attente pour l'utilisateur

1. ~~SOLID obligatoire ou approche simple ?~~ **Tranché : SOLID obligatoire** pour les nouveaux modules (voir `CLAUDE.md`).
2. ~~Commiter le travail en cours ?~~ **Fait** (commité et poussé sur `dev` à la demande de l'utilisateur).
3. **Passe de commentaires de réflexion** sur le code déjà écrit (il explique souvent le *quoi*, pas toujours le *pourquoi* des arbitrages) : à faire ou non ?

## 7. Reprendre en 3 commandes

```bash
git status                                   # confirmer que le travail non commité est toujours là
npm run typecheck && npm test && npm run build
unset ELECTRON_RUN_AS_NODE && npm run dev    # sinon Electron démarre comme un simple Node
```
