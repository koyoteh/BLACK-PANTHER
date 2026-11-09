# Black Panther

Black Panther is a Node.js WhatsApp multi-device bot.

## Project layout

- `black/` — bot runtime, configuration, assets, and security utilities.
- `Panther/` — commands, menu utilities, legacy feature modules, and tests.

Only required package, deployment, environment-template, license, and documentation files are kept at the repository root.

## Run

1. Install Node.js 20–24 and npm 9 or newer.
2. Run `npm install`.
3. Copy `.env-sample` to `.env` and configure the WhatsApp session and owner details. Never commit `.env` or session credentials.
4. Run `npm test` for the regression suite.
5. Run `npm start` to launch the bot.

JavaScript source files in this repository are obfuscated. Keep deployment secrets in the host's secret manager, not in source files.

Repository: [koyoteh/BLACK-PANTHER](https://github.com/koyoteh/BLACK-PANTHER)
