# MC Mod Launcher

Un launcher Minecraft Java fait maison, pour remplacer le launcher officiel. Le but final : lancer du Minecraft **moddé (Forge en priorité)**.

> État actuel : le vanilla se lance, l'auth Microsoft est codée mais pas encore testée de bout en bout, Forge n'est pas commencé.

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

## Lancer le projet

```bash
npm install
cp .env.example .env    # puis renseigner MAIN_VITE_MSA_CLIENT_ID (voir "Connexion Microsoft")
npm run dev             # app Electron en mode dev
npm run build           # compile dans out/
npm run typecheck       # vérification TypeScript
npm run cli -- 1.21.1 [pseudo] [--dry]   # teste le cœur sans interface
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

### Héritage de versions (prépare Forge)

Forge et Fabric ne remplacent pas Minecraft : leur JSON déclare `inheritsFrom: "1.20.1"`. Le launcher fusionne le JSON enfant avec celui du parent (librairies, arguments) et garde le `client.jar` du vanilla. C'est déjà en place, mais pas encore testé avec un vrai JSON Forge.

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
│   └── msa.ts         connexion Microsoft / Xbox / Minecraft
├── main/        Process principal Electron (fenêtre, IPC, stockage du compte)
├── preload/     Pont sécurisé entre l'interface et le main (window.launcher)
├── renderer/    Interface (HTML, CSS, TypeScript)
└── shared/      Types partagés entre main et renderer
scripts/cli.mts  Lancement en ligne de commande, sans interface
```

L'interface n'a aucun accès direct à Node : elle passe uniquement par les fonctions exposées dans [src/shared/api.ts](src/shared/api.ts) (`contextBridge`, sandbox activée, CSP restrictive).

Les données du jeu sont dans le dossier `userData` d'Electron (`%APPDATA%/mc-mod-launcher/minecraft` sous Windows) : versions, librairies, assets, runtimes Java.

## Avancement

### Fonctionnel
- [x] Installation et lancement de Minecraft vanilla (testé en 1.21.1 via le CLI)
- [x] Téléchargement automatique du bon Java (runtime Mojang)
- [x] Interface : choix de version (releases et snapshots), pseudo, progression, logs du jeu
- [x] Mode hors-ligne
- [x] Fusion des versions par héritage (`inheritsFrom`)
- [x] Code de l'auth Microsoft complet (device code, refresh, stockage chiffré)

### Codé mais non testé
- [ ] Auth Microsoft de bout en bout (il faut le `client_id` de l'app Azure, et l'approbation Mojang)
- [ ] Reconnexion automatique après redémarrage (refresh token)
- [ ] Lancement depuis l'interface Electron (seul le CLI a été testé jusqu'au jeu lancé)

### À faire
- [ ] **Forge / NeoForge** : installer une version et exécuter les « processors » de l'installer (piste : lancer l'installer officiel en headless avec le Java Mojang)
- [ ] **Instances** : un dossier de jeu par profil (mods, saves, options séparés) et un choix de mémoire par instance
- [ ] **Gestion des mods** : ajout, suppression, activation
- [ ] **Modpacks** : Modrinth (`.mrpack`) puis CurseForge (clé API requise)
- [ ] Fabric / Quilt (plus simple : un JSON à récupérer)
- [ ] Interface : liste des instances, gestion de plusieurs comptes, réglages (RAM, arguments JVM)
- [ ] Packaging (installeur Windows), icône, mise à jour automatique
- [ ] Tests automatisés sur le cœur (règles, résolution des librairies, fusion des versions)

### Limites connues
- Versions ≤ 1.7.2 : assets « legacy » (`virtual` / `map_to_resources`) non gérés.
- Un seul compte à la fois, une seule partie à la fois.
- Pas de gestion des « features » du JSON Mojang (mode démo, résolution personnalisée).

## Légal

Le launcher exige un vrai compte Minecraft Java pour l'auth Microsoft. Il ne redistribue aucun fichier de Mojang : tout est téléchargé depuis leurs serveurs.
