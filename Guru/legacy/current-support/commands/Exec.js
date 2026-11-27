import { exec as execPromise } from 'child_process';
import { promisify } from 'util';
import { MESSAGES } from '../france/index.js';

const exec = promisify(execPromise);

export const commands = [
  {
    name: 'exec',
    aliases: ['shell', 'cmd', 'run'],
    description: 'Execute shell commands on the bot server.',
    category: 'Owner',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      if (!text) {
        return sock.sendMessage(from, {
          text: MESSAGES.exec.noCommand
        }, { quoted: msg });
      }

      try {
        const { stdout, stderr } = await exec(text);

        let output = '';
        if (stdout) output += stdout;
        if (stderr) output += stderr;

        if (!output) {
          output = MESSAGES.exec.noOutput;
        }

        const maxLength = 4000;
        if (output.length > maxLength) {
          const parts = output.match(new RegExp(`[\\s\\S]{1,${maxLength}}`, 'g')) || [];
          for (const part of parts) {
            await sock.sendMessage(from, {
              text: MESSAGES.exec.output.replace('{output}', part)
            }, { quoted: msg });
          }
        } else {
          await sock.sendMessage(from, {
            text: MESSAGES.exec.output.replace('{output}', output)
          }, { quoted: msg });
        }

      } catch (error) {
        await sock.sendMessage(from, {
          text: MESSAGES.exec.error.replace('{error}', error.message)
        }, { quoted: msg });
      }
    }
  },
  {
    name: 'exec-help',
    aliases: ['execinfo', 'shell-help'],
    description: 'Shows available shell commands and examples for exec command.',
    category: 'Owner',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const helpText = MESSAGES.execHelp.info;
      await sock.sendMessage(from, { text: helpText }, { quoted: msg });
    }
  }
];
