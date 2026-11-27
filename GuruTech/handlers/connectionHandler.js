import { Boom } from '@hapi/boom';
import { DateTime } from 'luxon';
import { DisconnectReason } from '@whiskeysockets/baileys';
import { addSudoUser, getSudoUsers } from '../database/config.js';
import { getCachedSettings } from '../lib/settingsCache.js';
import { commands, totalCommands } from '../handlers/commandHandler.js';
import { isUltraHosting } from '../lib/hostPlatform.js';
import { sendOfficialLinkButtons } from '../lib/menuNavigation.js';
import { installOutgoingResponseDecorator } from '../lib/rudeResponses.js';
import { pantherConnectedTable } from '../lib/pantherStyle.js';

let hasSentStartMessage = false;

const RECHECK_INTERVAL_MS = 20 * 60 * 1000;
let trialCheckInterval = null;
let trialConfirmedPaid = false;

function getGreeting() {
  const hour = DateTime.now().setZone("Africa/Nairobi").hour;
  if (hour >= 5 && hour < 12) return "Hey there! Ready to kick off the day?";
  if (hour >= 12 && hour < 18) return "What's up? Time to make things happen!";
  if (hour >= 18 && hour < 22) return "Evening vibes! Let's get to it!";
  return "Late night? Let's see what's cooking!";
}

function getCurrentTime() {
  return DateTime.now().setZone("Africa/Nairobi").toLocaleString(DateTime.TIME_SIMPLE);
}

async function fetchTrialStatus(userId) {
  const apiBase = (process.env.ULTRA_HOSTING_API_BASE || '').trim().replace(/\/+$/, '');
  if (!apiBase) return 'unknown';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let res;
    try {
      const appName = process.env.HEROKU_APP_NAME ? `?app=${encodeURIComponent(process.env.HEROKU_APP_NAME)}` : '';
      const url = `${apiBase}/api/bots/trial-check/${encodeURIComponent(userId)}${appName}`;
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return 'unknown';
    }
    const data = await res.json();
    return data.status || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

async function runTrialCheck(socket, userId, botJid) {
  const status = await fetchTrialStatus(userId);

  if (status === 'trial_ended') {
    try {
      await socket.sendMessage(botJid, {
          text: [
            '⚠️ *Free Trial Ended*',
            '',
            'Your free trial has expired, or this WhatsApp number was already used for a free trial on another account.',
            '',
            'This bot is being removed from our servers.',
            '',
            'Contact the BLACK PANTHER owner for hosting support.',
            '',
            '_BLACK PANTHER_'
          ].join('\n')
        });
    } catch {}
    if (trialCheckInterval) {
      clearInterval(trialCheckInterval);
      trialCheckInterval = null;
    }
    await new Promise(r => setTimeout(r, 3000));
    process.exit(0);
    return false;
  }

  if (status === 'paid') {
    trialConfirmedPaid = true;
    if (trialCheckInterval) {
      clearInterval(trialCheckInterval);
      trialCheckInterval = null;
    }
  }

  return true;
}

async function connectionHandler(socket, connectionUpdate, reconnect) {
  installOutgoingResponseDecorator(socket);
  const { connection, lastDisconnect } = connectionUpdate;

  if (connection === "connecting") return;

  if (connection === "close") {
    const statusCode = new Boom(lastDisconnect?.error)?.output.statusCode;
    if (statusCode === DisconnectReason.loggedOut) {
      hasSentStartMessage = false;
    }
    return;
  }

  if (connection === "open") {
      globalThis.conn = socket;
      globalThis.sock = socket;
      globalThis.tox = socket;
      globalThis.ultraGuru = socket;
      globalThis.clint = socket;
      globalThis.bot = socket;
      globalThis.wx = socket;
      globalThis.client = socket;
    const userId = socket.user.id.split(":")[0].split("@")[0];
    const settings = await getCachedSettings();
    const sudoUsers = await getSudoUsers();

    let botJid = socket.user?.id || (userId + '@s.whatsapp.net');
    if (botJid.includes(':')) {
      botJid = botJid.split(':')[0] + '@s.whatsapp.net';
    }

    const hostedOnUltraHosting = await isUltraHosting();

    if (hostedOnUltraHosting && process.env.ULTRA_HOSTING_API_BASE) {
      const canProceed = await runTrialCheck(socket, userId, botJid);
      if (!canProceed) return;

      if (!trialConfirmedPaid && !trialCheckInterval) {
        trialCheckInterval = setInterval(() => {
          runTrialCheck(socket, userId, botJid).catch(() => {});
        }, RECHECK_INTERVAL_MS);
      }

      if (process.env.EXPIRY_NOTICE === '1') {
        try {
          await socket.sendMessage(botJid, {
            text: [
              '*Bot Subscription Expired*',
              '',
              'Your BLACK PANTHER bot subscription has expired!',
              '',
              'This bot will be permanently deleted in 24 hours unless you renew.',
              '',
              'Contact the BLACK PANTHER owner for renewal details.',
              '',
              '- BLACK PANTHER'
            ].join('\n')
          });
        } catch {}
      }
    }

    if (!hasSentStartMessage) {
      const isNewUser = !sudoUsers.includes(userId);
      if (isNewUser) {
        await addSudoUser(userId);
        const defaultSudo = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
        if (defaultSudo && !sudoUsers.includes(defaultSudo)) {
          await addSudoUser(defaultSudo);
        }
      }

      const effectivePrefix = settings.prefix || '.';
      const connectedTable = pantherConnectedTable({
        mode: settings.mode,
        prefix: effectivePrefix,
        commands: totalCommands,
        time: getCurrentTime()
      });

      try {
        await sendOfficialLinkButtons(socket, botJid, connectedTable);
      } catch (error) {}

      hasSentStartMessage = true;
    }
  }
}

export default connectionHandler;
