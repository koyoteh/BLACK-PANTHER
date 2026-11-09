![Black Panther](https://raw.githubusercontent.com/koyoteh/BLACK-PANTHER/main/black/assets/black-panther.jpg)

# BLACK PANTHER MD

A multi-device WhatsApp bot with command tools, media features, group administration, and owner-controlled security settings.

[![Stars](https://img.shields.io/github/stars/koyoteh/BLACK-PANTHER?style=social)](https://github.com/koyoteh/BLACK-PANTHER/stargazers)
[![Forks](https://img.shields.io/github/forks/koyoteh/BLACK-PANTHER?style=social)](https://github.com/koyoteh/BLACK-PANTHER/network/members)
[![License](https://img.shields.io/github/license/koyoteh/BLACK-PANTHER)](https://github.com/koyoteh/BLACK-PANTHER/blob/main/LICENSE)

---

## Quick start

1. **Get the project:** [fork Black Panther](https://github.com/koyoteh/BLACK-PANTHER/fork) or [download the ZIP](https://github.com/koyoteh/BLACK-PANTHER/archive/refs/heads/main.zip).
2. **Install the requirements:** use Node.js 20–24 and run `npm install` from the project directory.
3. **Configure your session:** copy `.env-sample` to `.env`, then set `SESSION` or `SESSION_ID` and your owner settings. Keep your session private.
4. **Start the bot:** run `npm start`. Run `npm test` to execute the regression tests.

```bash
git clone https://github.com/koyoteh/BLACK-PANTHER.git
cd BLACK-PANTHER
npm install
cp .env-sample .env
npm test
npm start
```

## What it includes

Black Panther brings together chat commands for media and downloads, AI and search utilities, group tools, games, stickers, and bot settings. Features that need external providers may require their own API credentials in the host's secret manager.

The security controls include an owner-only emergency lockdown (`.lockdown on`, `.lockdown off`, and `.lockdown status`), a security status command (`.security`), and a privacy-minimal audit view (`.securitylog`). Owner-only command checks and command-rate limits are enforced centrally.

Auto-reaction to ordinary messages is opt-in. Set `AUTO_REACT=on` in `.env` and choose `AUTO_REACT_MODE=all`, `groups`, or `dm` if you want to enable it. It is off by default.

## Run it on your host

Use a Node.js host that supports persistent processes. Set the environment values from `.env-sample` in the host's configuration panel, then use `npm install` for the build and `npm start` for the run command. Do not upload `.env`, WhatsApp credentials, or API keys to GitHub.

## Project layout

- `black/` contains the bot runtime, configuration, assets, and security utilities.
- `Panther/` contains commands, menu utilities, the retained feature modules, and regression tests.

## Keep your account safe

Never publish your WhatsApp session, `SESSION` or `SESSION_ID` values, API keys, or private deployment credentials. JavaScript files in this repository are obfuscated; use the environment template for configuration and store real secrets only with your hosting provider.

---

[Open the repository](https://github.com/koyoteh/BLACK-PANTHER) · [Report an issue](https://github.com/koyoteh/BLACK-PANTHER/issues) · [WhatsApp Channel](https://whatsapp.com/channel/0029VbDh88NCMY0Fartkxm1g)
