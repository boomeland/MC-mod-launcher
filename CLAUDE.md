# boomLauncher

Launcher Minecraft Java (Electron + TypeScript) pour lancer du Minecraft moddé, Forge en priorité.

Le CLAUDE.md global s'applique (posture mentor, commentaires de réflexion, DRY, boucle plan → roast → re-plan, bugs bloquants → retour en planification). **Ce fichier ne le répète pas** : il contient uniquement ce qui est propre au projet, et les endroits où une règle globale doit être *adaptée* parce qu'elle vise un autre type d'app. Ce fichier est chargé à chaque session : le garder court fait partie du travail.

## Commandes

```bash
npm run dev          # app Electron en dev
npm run build        # compile dans out/
npm run typecheck    # tsc --noEmit
npm test             # node:test via tsx (tests/*.test.mts)
npm run dist         # .exe Windows (installeur + portable) dans dist/, config dans le champ "build" de package.json
git tag vX.Y.Z && git push origin vX.Y.Z   # release publiée par GitHub Actions (tag = version de package.json ; suffixe -xxx = pré-release)
npm run cli -- 1.20.1 [pseudo] [--forge[=v] | --neoforge[=v] | --fabric[=v]] [--instance=nom] [--dry]   # cœur sans UI, données dans .cli-data/
npm run cli -- ftb:<id> | mr:<id|slug> --instance=nom [--dry]   # modpack FTB ou Modrinth (ftb:93 et mr:fabulously-optimized passent à 2 Go)
```

Avant de conclure une modification : `npm run typecheck && npm test && npm run build`.

## Adaptations des règles globales

- **Taille des fichiers** : la limite globale est 350 lignes. Ici on vise **≤ 350**, parce que les modules sont petits et que le découpage par domaine est déjà fait (le plus gros fichier est largement sous la barre). Si un fichier approche 350, découper avant d'y ajouter quoi que ce soit.
- **SoC (`.types.ts` / `.hooks.ts` / `.utils.ts`)** : cette règle vise React. Ici **pas de framework UI, donc pas de hooks**. La séparation se fait autrement : les types partagés sont dans `core/types.ts` (domaine) et `shared/api.ts` (contrat IPC), les helpers UI dans `renderer/dom.ts` (`el`, `tile`), `renderer/status.ts` et `renderer/views.ts`. Ne pas créer de `.hooks.ts` vide pour « respecter » la règle.
- **SOLID** : **obligatoire** (décidé le 21/09/2026) pour les nouveaux modules majeurs (NeoForge, gestion des mods, modpacks) : interfaces par rôle (`Loader`, source de mods…), dépendances injectées en paramètre plutôt qu'importées en dur. Sans framework ni conteneur d'injection. Le code existant n'est migré que lorsqu'un module le touche, pas dans un refactoring à part. **SOLID reste soumis à la boucle anti-suringénierie ci-dessous, sans exception** : une interface naît quand sa deuxième implémentation réelle arrive (ex. `Loader` au moment où NeoForge rejoint Forge), jamais avant.
- **Checklist sécurité web (RBAC, GraphQL, OIDC…)** : ne s'applique pas, il n'y a **ni serveur ni multi-utilisateur**. L'équivalent local est la section « Surface de confiance » ci-dessous.
- **Section Odoo** : hors sujet ici.

## Surface de confiance (l'équivalent local de l'audit sécu)

Trois frontières seulement, mais elles comptent :

1. **IPC renderer → main** : le renderer n'a aucun accès à Node (`sandbox: true`, CSP, `contextBridge`). Toute nouvelle capacité passe par `LauncherApi` → `preload/index.ts` → `ipcMain`. Un handler `ipcMain` traite ses arguments comme des **entrées non fiables**, jamais comme déjà validées par l'UI (ex. `packs:install` ne reçoit que des ids et relit MC/loader depuis la source ; `mods:*` relit l'instance par son id).
2. **Chemins construits depuis une entrée** : les ids d'instance sont validés contre `^[a-z0-9]+(-[a-z0-9]+)*$` **avant tout accès disque**, car `deleteInstance` fait un `rm -r` qui efface les mondes du joueur. Ne jamais fabriquer un chemin d'instance sans passer par `instanceDir()` de `core/instances.ts` (couvert par les tests, y compris les cas `../`). Tout autre chemin venu de l'extérieur passe par `insideDir()` de `core/paths.ts` : fichiers d'un modpack, entrées d'un `.mrpack` (zip slip), noms de mods reçus par IPC (`modPath()` de `core/mods.ts`, qui n'accepte qu'un nom de `.jar`).
3. **Secrets** : aucun refresh token en clair sur disque — `safeStorage` uniquement, et si le chiffrement n'est pas disponible on **ne persiste pas**. Le `client_id` Azure vit dans `.env` (non commité, voir `.env.example`).

## Architecture

- `src/core/` : logique métier, **sans dépendance à Electron** (donc testable en CLI et en `node:test`). `msa/` et `loaders/` sont des dossiers avec un `index.ts` d'entrée. `loaders/index.ts` définit l'interface `Loader` et la table `LOADERS` : un nouveau loader = un fichier + une entrée dans la table + une valeur dans `MOD_LOADERS` (`core/types.ts`). `modpacks/index.ts` : interface `ModpackSource` (FTB, Modrinth) et table `PACK_SOURCES`, même principe. `modrinth.ts` est le client API partagé par les modpacks et les mods (`modrinth-mods.ts`).
- `src/main/` : process Electron. `index.ts` ne fait que brancher ; un fichier IPC par domaine dans `ipc/` (versions, instances, modpacks, mods, auth, game).
- `src/preload/` + `src/shared/api.ts` : seul pont vers le renderer (`window.launcher`).
- `src/renderer/` : un module par zone (instances, create, discover, mods, settings, account, play, status) ; trois vues (instance, vide, Modpacks) basculées par `views.ts`. Mods et Réglages s'abonnent à `onInstanceChange` d'`instances.ts` (pas d'import circulaire) ; `version-picker.ts` sert à la création et aux Réglages. Thème : variables CSS dans `:root` de `style.css`, une couleur par loader (`--forge`…). Le renderer n'importe que des **types** depuis `core/` (`import type`), jamais du code Node.
- **CSP** (`index.html`) : `img-src` n'autorise que les CDN FTB et Modrinth, alignés sur `IMAGE_HOSTS` de `core/modpacks/common.ts`. Toute nouvelle source d'images se change aux deux endroits.
- Données à l'exécution : `userData/minecraft/` (partagé : versions, libs, assets, Java) et `userData/instances/<id>/{instance.json,minecraft/}` (un dossier de jeu par instance).

## Pièges déjà rencontrés

- **`ELECTRON_RUN_AS_NODE=1`** est défini dans les terminaux VS Code / Claude Code : Electron tourne alors comme un simple Node (`electron.app` est `undefined`). `unset` avant de lancer l'app.
- **Jamais `windowsHide: true` sur le process du jeu** : sous Windows ça cache aussi la fenêtre de Minecraft (symptôme vécu : le son tourne, pas de fenêtre). `spawnGame` utilise `javaw.exe` sans `windowsHide`. L'option reste correcte pour l'installer Forge/NeoForge, qui est réellement headless.
- **Isoler l'app pour un test d'UI : `--user-data-dir=<dossier>`** (vérifié). Surcharger `APPDATA` ne suffit PAS : Electron l'ignore sous Windows et écrit dans le vrai `%APPDATA%\mc-mod-launcher\` de l'utilisateur.
- **Jamais `alert()` / `confirm()` / `prompt()` dans le renderer** : sous Windows, après la boîte native, le clavier n'atteint plus les champs texte (la souris marche encore). Symptôme vécu, reproduit avec de vraies frappes. Une confirmation passe par `dialog.showMessageBox` côté main (cf. `instances:delete`). CDP (`Input.dispatchKeyEvent`) ne voit pas ce bug : tester le clavier avec `SendKeys`, fenêtre de test au premier plan vérifiée.
- **RAM des tests ≤ 2048 Mo** (demande de l'utilisateur) : instances de test, `--instance=` du CLI et lancements réels. Pour un modpack, tester avec FTB Ultimate Anniversary (`ftb:93`) ou Fabulously Optimized (`mr:fabulously-optimized`, version 1.21.1) : les autres demandent 4 à 8 Go.
- **Les logs du jeu peuvent figer le renderer** : ne jamais ajouter au DOM ligne par ligne sans plafond (vécu : 5 Go, interface figée). `renderer/status.ts` regroupe par image et tronque ; la console du jeu est en XML log4j, décodée dans le main (`core/log4j.ts`). Ne pas retirer la config log4j de Mojang pour « simplifier » : elle corrige Log4Shell.
- **Forge / NeoForge : le jar vanilla doit être copié sous l'id de la version lancée** (`versions/<id>/<id>.jar`, fait dans `install.ts`) car Forge l'ignore par ce nom via `-DignoreList`. Sans ça : crash « Module minecraft contains package… ». Les librairies à URL vide sont générées par l'installer, donc non téléchargeables.
- **Ne jamais tuer `java.exe` / `javaw.exe` par nom** pendant un test : ça fermerait le vrai Minecraft de l'utilisateur. Tuer par PID, en filtrant la ligne de commande sur `.cli-data`.
- **Ne jamais lancer `asar extract-file` depuis la racine du projet** : il extrait dans le dossier courant, et `extract-file … package.json` a écrasé le `package.json` du projet (vécu, restauré). Lister avec `asar list`, extraire dans le scratchpad.
- **Ne pas mettre `productName` au niveau racine de `package.json`** (seulement dans `build`) : Electron en tirerait le nom de l'app, et l'exe irait chercher ses données dans `%APPDATA%\boomLauncher\` au lieu de `mc-mod-launcher\`, perdant instances et téléchargements.
- **Le launcher s'appelle boomLauncher, mais `name` (`mc-mod-launcher`) et `build.appId` (`com.boomeland.mcmodlauncher`) ne changent pas** : le premier fixe le dossier de données, le second l'identité de l'installation Windows (un autre `appId` = une deuxième installation à côté au lieu d'une mise à jour).
- **Tester la mise à jour automatique sans publier de fausse release** : compiler en local une version inférieure à la release publiée (`npm version 0.x.99 --no-git-tag-version`, `npm run dist`, puis revenir), l'installer en silence (`Setup.exe /S /currentuser /D=<dossier>`), la lancer : elle doit trouver la release, la télécharger et s'y mettre à jour. Pour tester une version **pas encore publiée** : servir `dist/` en HTTP local et remplacer temporairement `resources/app-update.yml` de l'installation par `provider: generic` + `url: http://127.0.0.1:<port>/` (vérifié pour la 0.3.1 : l'installeur réécrit ce fichier avec la config GitHub). L'utilisateur a une installation dans `K:JeuxMC Mod Launcher` : c'est elle qui est mise à jour. Le updater est inactif en dev (`app.isPackaged`).
- **La version n'est écrite que dans `package.json`** (lue par `core/launch.ts` pour `-Dminecraft.launcher.version`) : monter la version avec `npm version X.Y.Z --no-git-tag-version`, qui met aussi à jour le lock.
- **`package-lock.json` est généré par npm** : ne pas l'éditer à la main, ne pas le « découper » (sa taille n'est pas un problème de qualité de code).
- **Fichiers en CRLF + pas de `python` fiable** ici : les remplacements multi-lignes par script échouent silencieusement. Utiliser les outils d'édition, pas un `sed`/one-liner multi-lignes.

## Git

- Branche de travail : **`dev`**. `main` reçoit `dev` via des PR faites sur GitHub par l'utilisateur.
- Messages de commit en français : sujet court, puis corps expliquant le *pourquoi*.
- **Commiter ou pousser uniquement sur demande explicite.**

## État courant

- **Auth Microsoft** : device code, Xbox Live et XSTS validés contre les vrais serveurs. L'étape finale `login_with_xbox` renvoie 403 tant que Mojang n'a pas approuvé l'app Azure (`aka.ms/AppRegInfo`). **Mojang a refusé la première demande (22/09/2026)** : le launcher a été renommé de « MC Mod Launcher » en « boomLauncher » à la suite de ce refus. **Hors-ligne verrouillé dans l'app packagée** tant qu'aucune connexion n'a prouvé la possession du jeu (fichier `owner-verified`, cf. `main/accounts.ts`) : en attendant l'approbation, on joue en dev ou via le CLI. Pour tester l'exe avec un profil isolé, créer `owner-verified` dans le `--user-data-dir`.
- **Testé en lancement réel** : vanilla 1.21.1, Forge 1.20.1 (Java 17), Forge 1.12.2 (Java 8, ancien format de JSON), NeoForge 21.1.251 (MC 1.21.1, Java 21) les modpacks FTB Ultimate Anniversary (Forge 1.16.5) et Fabulously Optimized (Modrinth, Fabric 1.21.1), et un mod Modrinth (JEI) chargé par NeoForge, tous lancés depuis « Jouer » dans l'app.
- Roadmap et détail du fonctionnement : **README.md** (ne pas dupliquer ici, ça périme).

## Boucle de vérification de suringénierie

La boucle globale plan → roast → re-plan pousse à **ajouter** (chaque itération trouve un cas limite de plus). Cette boucle-ci est son contrepoids : elle passe en dernier, juste avant de conclure, et elle ne cherche qu'à **retirer**. Sans elle, le roast produit mécaniquement du code défensif que personne n'a demandé.

Relire le diff de la tâche en cours (pas tout le dépôt) avec ces questions, dans cet ordre :

1. **Ça sert déjà deux fois ?** Une abstraction (helper, interface, option, classe) créée pour **un seul** appelant → l'inliner. Attendre le deuxième cas réel pour factoriser.
2. **Quelqu'un l'a demandé ?** Paramètre, flag, réglage ou point d'extension « au cas où » → supprimer (YAGNI).
3. **Je peux supprimer ces lignes sans changer le comportement observable ni casser les tests ?** Si oui : supprimer. Git garde l'historique, inutile de conserver « au cas où ».
4. **Cette branche défensive couvre-t-elle un cas réellement atteignable ?** `try/catch` qui avale une erreur, garde sur une valeur déjà validée en amont, valeur par défaut sur un champ obligatoire → supprimer, ou remplacer par une erreur franche.
5. **Le nom promet-il plus que le code ne fait ?** `Manager`/`Service`/`Factory` autour de trois lignes → aplatir et renommer d'après ce que ça fait vraiment.

Si une réponse fait supprimer du code : relancer `npm run typecheck && npm test`, puis refaire une passe. **S'arrêter dès qu'une passe ne retire plus rien** (en général la deuxième) — la boucle sert à dégraisser, pas à réécrire.

**Exception explicite** : une complexité qui reste doit être *justifiée dans un commentaire de réflexion*. Exemples dans ce dépôt — le marqueur `.installed-by-launcher` (évite de rejouer un installer Forge/NeoForge de plusieurs minutes), la copie du jar vanilla sous l'id de la version (contrainte `-DignoreList` de Forge), le `mkdir` non récursif pour réserver un dossier d'instance (atomicité). Une complexité sans *pourquoi* écrit est un candidat à la suppression au prochain passage.
