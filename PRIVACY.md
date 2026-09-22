# boomLauncher — Privacy Policy

*Last updated: September 22, 2026*

boomLauncher is a free, open-source Minecraft: Java Edition launcher for Windows ([source code](https://github.com/boomeland/boomLauncher), MIT license). It runs entirely on your computer. There is no boomLauncher server, no account system of our own, no analytics and no telemetry.

## What the launcher accesses

**Your Microsoft account.** Playing requires signing in once with a Microsoft account that owns Minecraft: Java Edition. Sign-in uses Microsoft's device code flow: you enter a code on `microsoft.com/link`, in your own browser. The launcher never sees your password. It requests only the `XboxLive.signin` and `offline_access` scopes, which are needed to get a Minecraft session and to stay signed in.

After sign-in, the launcher keeps:

| Data | Where | Why |
|---|---|---|
| Minecraft username and UUID | `%APPDATA%\mc-mod-launcher\account.json` | Show who is signed in, launch the game |
| Microsoft refresh token | Same file, **encrypted** with the operating system's credential protection (Electron `safeStorage`, Windows DPAPI). If encryption is unavailable, it is not saved at all. | Stay signed in between sessions |
| Minecraft access token | In memory only, passed to the game when it starts | Required by Minecraft to join online servers |
| An empty `owner-verified` file | `%APPDATA%\mc-mod-launcher\` | Records that game ownership was confirmed once, which unlocks offline play |

Signing out deletes `account.json`. Offline play (for offline-mode servers) is only available after a successful sign-in has confirmed that you own the game.

**Your game files.** Instances, mods, worlds and downloaded game files are stored in `%APPDATA%\mc-mod-launcher\` on your computer. Uninstalling the launcher leaves them there, so you do not lose your worlds; delete that folder to remove everything.

## Services the launcher contacts

The launcher sends requests only to the services needed to download and run the game. None of them receives your account data except Microsoft, Xbox Live and Minecraft Services during sign-in.

- **Microsoft, Xbox Live, Minecraft Services**: sign-in and your Minecraft profile.
- **Mojang** (`piston-meta.mojang.com`, `libraries.minecraft.net`, `resources.download.minecraft.net`…): game versions, libraries, assets and the Java runtime.
- **Forge, NeoForge, Fabric**: mod loader versions and installers.
- **Modrinth** and **Feed The Beast**: mod and modpack catalogs, files and images.
- **GitHub**: checking for and downloading launcher updates; some modpack files hosted on GitHub or GitLab.

Each of these services applies its own privacy policy to the requests it receives (for example your IP address).

## What the launcher does not do

- No analytics, tracking, advertising or crash reporting.
- No data is sold, shared with or sent to the launcher's author.
- No Mojang files are redistributed: everything is downloaded from official servers.

## Contact

Questions or concerns: open an issue at <https://github.com/boomeland/boomLauncher/issues>.
