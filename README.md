# MC Mod Launcher

Launcher Minecraft en Electron + TypeScript. Objectif : lancer du Minecraft moddé (Forge en priorité).

## Lancer

```bash
npm install
npm run dev        # app Electron en mode dev
npm run cli -- 1.21.1 [pseudo] [--dry]   # test du cœur sans UI (données dans .cli-data/)
```

> Si l'app plante avec `Cannot read properties of undefined (reading 'getPath')`, la variable
> d'environnement `ELECTRON_RUN_AS_NODE` est définie (terminal VS Code / Claude Code) : `unset` avant `npm run dev`.

## Architecture

- `src/core/` : logique du launcher, sans dépendance à Electron
  - `version.ts` manifest Mojang + fusion `inheritsFrom` (base pour Forge/Fabric)
  - `libraries.ts` / `rules.ts` résolution des librairies selon l'OS
  - `install.ts` client.jar, libs, natives, assets, Java
  - `java.ts` runtime Java officiel Mojang
  - `launch.ts` construction de la commande et spawn
  - `auth.ts` compte offline (Microsoft à faire)
- `src/main`, `src/preload`, `src/renderer` : Electron

## Roadmap

- [x] Vanilla : install + lancement
- [ ] Auth Microsoft
- [ ] Forge / NeoForge (installer + processors)
- [ ] Instances (dossiers de jeu séparés, mods)
- [ ] Modpacks (Modrinth / CurseForge)

Limites connues : assets legacy `virtual`/`map_to_resources` (versions ≤ 1.7.2) non gérés.
