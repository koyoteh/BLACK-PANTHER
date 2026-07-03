import axios from 'axios';
import { herokuAppName, getHerokuApiKey } from '../../config/settings.js';
import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js'; 
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const herokuApiKey = getHerokuApiKey();
        const { client, m, text, Owner, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        if (!herokuAppName || !herokuApiKey) {
            await sendInteractive(client, m, "⚡ ──「 SETVAR 」──\n▢ Heroku app name or API key not set, you clown.\n▢ Set HEROKU_APP_NAME and HEROKU_API_KEY first!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──");
            return;
        }

        if (!text) {
            await sendInteractive(client, m, `⚡ ──「 SETVAR 」──
▢ Provide a var and value, moron.\n▢ Format: ${prefix}setvar VAR_NAME=VALUE\n▢ Example: ${prefix}setvar MYCODE=254\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
            return;
        }

        async function setHerokuConfigVar(varName, value) {
            try {
                const response = await axios.patch(
                    `https://api.heroku.com/apps/${herokuAppName}/config-vars`,
                    {
                        [varName]: value
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${herokuApiKey}`,
                            Accept: "application/vnd.heroku+json; version=3" } }
                );

                if (response.status === 200) {
                    await sendInteractive(client, m, `⚡ ──「 SETVAR 」──
▢ ${varName} updated to "${value}"\n▢ Wait 2min for bot to restart, be patient.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                } else {
                    await sendInteractive(client, m, "▢ Failed to update the config var. Try again, loser.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──");
                }
            } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                const errorMessage = error.response?.data || error.message;
                await sendInteractive(client, m, `⚡ ──「 HEROKU ERROR 」──
▢ Failed to set config var.\n▢ ${errorMessage}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                console.error("Error updating config var:", errorMessage);
            }
        }

        const parts = text.split("=");
        if (parts.length !== 2) {
            await sendInteractive(client, m, `⚡ ──「 SETVAR 」──\n▢ Invalid format, you illiterate fool.\n▢ Use: ${prefix}setvar VAR_NAME=VALUE\n▢ Example: ${prefix}setvar MYCODE=254\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
            return;
        }

        const varName = parts[0].trim();
        const value = parts[1].trim();

        await setHerokuConfigVar(varName, value);
    });
};
