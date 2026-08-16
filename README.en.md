[中文](README.md) | English

# dsh-dsov-plugin

A lightweight plugin for the DSH Web GUI: it adds a first-position 【Overview】 tab to the right sidebar with real-time session duration and model usage stats, and lets the 【DeepSeek 开放平台】 entry in the settings panel jump straight to the official platform.

## ✨ Features

- **Sidebar 【Overview】 panel**: adds a first-position 【Overview】 tab to the right sidebar (fixed order: Overview / Files / Changes) with real-time session duration, API request count and per-model usage (tokens, cache hit rate, cost, etc.), auto-refreshing every second with no manual action needed;
- **Light / dark theme adaptive**: every surface follows the DSH system theme automatically — cards, text, progress bars and colors adapt on their own, no extra configuration;
- **One-click official platform**: a new 【DeepSeek 开放平台】 nav entry in the settings panel opens https://platform.deepseek.com  ,directly in the system default browser — no second click, no intermediate page.


<div align="center">
<img src="./assets/overview-panel.png" alt="Overview Panel" width="250">
</div>

<br>

<div align="center">
<img src="./assets/settings-platform-entry.png" alt="Platform Entry in Settings" width="800">
</div>


## 📋 Prerequisites

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) installed and usable, with the `dsh` CLI available (globally installed or on PATH);
- Node.js 18+ (20+ recommended);
- Target profile `web` (this plugin targets the web mode only: `--profile web`).

## 📥 Installation

### Option 1: Install from npm (end users)

```bash
# The package is published on npm as @univerxyz/dsh-dsov-plugin; install into the DSH web profile:
dsh plugin --profile web add @univerxyz/dsh-dsov-plugin

# Restart dsh web for the plugin to take effect:
dsh --profile web
```

### Option 2: Build from source (developers / custom builds)

```bash
# 1) Clone the repository
git clone https://github.com/univerxyz/dsh-dsov-plugin.git
cd dsh-dsov-plugin

# 2) Install dependencies (zero runtime deps; build toolchain only)
npm install

# 3) Build into lib/
npm run build

# 4) Link into the local web profile (equivalent to dsh plugin add link:<absolute repo path>)
npm run link:web

# 5) Restart dsh web for the bundle patch to take effect
dsh --profile web
```

## 🚀 Usage

1. Start `dsh --profile web` and open the web UI;
2. Click the 【Overview】 tab in the right sidebar to view the current session's real-time usage (session duration, API requests, tokens consumed, cache hit rate, cost, etc.);
3. Open the settings panel and click 【DeepSeek 开放平台】 in the left navigation — the system default browser opens https://platform.deepseek.com directly.

## 🛠️ Development

```bash
npm run build                                              # build lib/ (zero-dependency Node script)
npm run link                                               # build and link into profile web
npm run link:web                                           # same, explicitly targeting web
node scripts/link-profile.mjs --unlink                     # remove from the profile
node scripts/link-profile.mjs --profile tui                # link into another profile
```

Project layout:

```
dsh-dsov-plugin/
├── package.json          # publishable npm package (dsh.bundle.patch / dsh.client)
├── cordis.patch.yml      # profile bundle patch: inserts plugin row ui-dsh-dsov
├── src/
│   ├── index.js          # host: llm/stream metering + agent active-time + /dsov route
│   └── client.js         # client: overview panel + settings nav jump (browser)
├── scripts/
│   ├── build.mjs         # build: src → lib (incl. module-loader wrapper)
│   └── link-profile.mjs  # build + dsh plugin add link: (falls back to manual link on pnpm policy blocks)
├── lib/                  # build output
├── README.md             # 简体中文
├── README.en.md          # this file
└── LICENSE               # MIT
```

## ⚠️ Troubleshooting

**Q: The 【Overview】 tab /【DeepSeek 开放平台】 does not appear after installation?**
A: Make sure you restarted `dsh --profile web` (the bundle patch is applied at boot) and installed into the `web` profile.

**Q: `dsh plugin add` fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`?**
A: The profile's pnpm supply-chain policy (`minimumReleaseAge`) has frozen the lockfile — unrelated to this plugin. Wait for the offending entries to pass the policy age, add them to `minimumReleaseAgeExclude`, or rebuild the lockfile with `pnpm clean --lockfile && pnpm install` inside the profile. `link-profile.mjs` detects this policy and automatically falls back to a manual link (junction), so installation still works without pnpm.

**Q: The plugin fails to load after renaming the package?**
A: The client bundle's module id is taken from `package.json`'s `name`; after renaming you must re-run `npm run build` and re-link.

**Q: Why is the session usage empty / reset after a restart?**
A: The overview shows process-local real-time stats for the current session, counting model calls since the plugin started; a fresh start after restart is expected.

## 📄 License

Licensed under the [MIT License](LICENSE).
