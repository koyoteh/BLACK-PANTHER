import {
  detectPlatform,
  formatUptime,
  MESSAGES,
  delay
} from '../france/index.js';

import now from 'performance-now';

if (!global.botStartTime) global.botStartTime = Date.now();

export const commands = [
  {
    name: 'alive',
    description: 'Check if the bot is alive with uptime and ping.',
    category: 'General',
    execute: async ({ sock, from, text, msg }) => {
      const start = now();

      await sock.sendMessage(from, {
        text: MESSAGES.alive.checking
      });

      const latency = (now() - start).toFixed(0);
      await delay(1000);

      const uptime = Date.now() - global.botStartTime;
      const formattedUptime = formatUptime(uptime);
      const platform = detectPlatform();
      const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

      const finalText = `${MESSAGES.alive.online}

${MESSAGES.alive.uptime.replace('{uptime}', formattedUptime)}
${MESSAGES.alive.ping.replace('{latency}', latency)}
${MESSAGES.alive.platform.replace('{platform}', platform)}
${MESSAGES.alive.ram.replace('{ram}', ramUsage)}`;

      await sock.sendMessage(from, {
        text: finalText
      });
    }
  }
];
