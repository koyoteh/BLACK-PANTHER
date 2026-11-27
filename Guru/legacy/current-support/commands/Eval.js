import {
  truncateMessage,
  formatError,
  MESSAGES,
  LIMITS
} from '../france/index.js';

import util from 'util';

export const commands = [
  {
    name: 'eval2',
    category: 'User',
    description: 'Eval JavaScript (sync / async)',
    execute: async ({ sock, from, text, msg, commands, config, totalCommands }) => {
      if (!text) {
        return sock.sendMessage(from, { text: MESSAGES.eval.noCode });
      }

      try {
        let groupMetadata = null;
        let participants = [];
        let groupAdmins = [];

        if (from.endsWith('@g.us')) {
          groupMetadata = await sock.groupMetadata(from);
          participants = groupMetadata.participants || [];
          groupAdmins = participants.filter(p => p.admin).map(p => p.id);
        }

        const sender = msg.key.participant || msg.key.remoteJid;

        const fs = await import('fs');
        const path = await import('path');
        const crypto = await import('crypto');
        const os = await import('os');
        const child_process = await import('child_process');
        const http = await import('http');
        const https = await import('https');
        const url = await import('url');
        const querystring = await import('querystring');
        const zlib = await import('zlib');
        const stream = await import('stream');
        const buffer = await import('buffer');
        const events = await import('events');

        const moment = await import('moment-timezone');
        const axios = (await import('axios')).default;
        const cheerio = (await import('cheerio')).default;
        const FormData = (await import('form-data')).default;
        const fetch = (await import('node-fetch')).default;

        const getUserNumber = (jid) => {
          if (!jid) return null;
          const number = jid.split('@')[0];
          return number.replace(/\D/g, '');
        };

        const downloadMedia = async (message) => {
          const buffer = await sock.downloadMediaMessage(message);
          return buffer;
        };

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const formatBytes = (bytes, decimals = 2) => {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const dm = decimals < 0 ? 0 : decimals;
          const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        };

        const formatTime = (ms) => {
          const seconds = Math.floor(ms / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);
          const days = Math.floor(hours / 60);

          return {
            days,
            hours: hours % 24,
            minutes: minutes % 60,
            seconds: seconds % 60,
            ms: ms % 1000
          };
        };

        const getRandom = (arr) => {
          return arr[Math.floor(Math.random() * arr.length)];
        };

        const isUrl = (string) => {
          try {
            new URL(string);
            return true;
          } catch (_) {
            return false;
          }
        };

        const context = {
          sock,
          msg,
          from,
          sender,
          text,
          groupMetadata,
          participants,
          groupAdmins,
          commands,
          config,
          totalCommands,

          fs: fs.promises,
          fsSync: fs.default,
          path: path.default,
          crypto: crypto.default,
          os: os.default,
          child_process: child_process.default,
          http: http.default,
          https: https.default,
          url: url.default,
          querystring: querystring.default,
          zlib: zlib.default,
          stream: stream.default,
          buffer: buffer.default,
          events: events.default,
          util,

          moment: moment.default,
          axios,
          cheerio,
          FormData,
          fetch,

          getUserNumber,
          downloadMedia,
          sleep,
          formatBytes,
          formatTime,
          getRandom,
          isUrl,

          console,
          process,
          setTimeout,
          setInterval,
          clearTimeout,
          clearInterval,
          setImmediate,
          clearImmediate,
          Buffer,
          URL,
          URLSearchParams,
          TextEncoder,
          TextDecoder,
          ArrayBuffer,
          Uint8Array,
          Uint16Array,
          Uint32Array,
          Int8Array,
          Int16Array,
          Int32Array,
          Float32Array,
          Float64Array,
          BigInt64Array,
          BigUint64Array,
          DataView,
          Map,
          Set,
          WeakMap,
          WeakSet,
          Promise,
          Symbol,
          Proxy,
          Reflect,
          JSON,
          Math,
          Date,
          RegExp,
          Error,
          TypeError,
          RangeError,
          SyntaxError,
          ReferenceError,
          EvalError,
          URIError,

          encodeURI,
          encodeURIComponent,
          decodeURI,
          decodeURIComponent,
          escape,
          unescape,
          parseFloat,
          parseInt,
          isNaN,
          isFinite,

          eval: (code) => eval(code),
          Function,

          baileys: await import('@whiskeysockets/baileys'),

          env: process.env,

          now: Date.now(),
          date: new Date(),

          random: Math.random,
          floor: Math.floor,
          ceil: Math.ceil,
          round: Math.round,
          abs: Math.abs,
          max: Math.max,
          min: Math.min,
          sqrt: Math.sqrt,
          pow: Math.pow,
          sin: Math.sin,
          cos: Math.cos,
          tan: Math.tan,
          log: Math.log,
          exp: Math.exp,

          arrayFrom: Array.from,
          arrayIsArray: Array.isArray,

          objectKeys: Object.keys,
          objectValues: Object.values,
          objectEntries: Object.entries,
          objectFromEntries: Object.fromEntries,
          objectAssign: Object.assign,
          objectCreate: Object.create,
          objectDefineProperty: Object.defineProperty,
          objectDefineProperties: Object.defineProperties,
          objectGetOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
          objectGetOwnPropertyDescriptors: Object.getOwnPropertyDescriptors,
          objectGetOwnPropertyNames: Object.getOwnPropertyNames,
          objectGetOwnPropertySymbols: Object.getOwnPropertySymbols,
          objectGetPrototypeOf: Object.getPrototypeOf,
          objectSetPrototypeOf: Object.setPrototypeOf,
          objectIs: Object.is,
          objectSeal: Object.seal,
          objectFreeze: Object.freeze,
          objectPreventExtensions: Object.preventExtensions,
          objectIsSealed: Object.isSealed,
          objectIsFrozen: Object.isFrozen,
          objectIsExtensible: Object.isExtensible
        };

        const keys = Object.keys(context);
        const values = Object.values(context);

        let result;

        if (text.includes('await') || text.includes('async')) {
          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
          const fn = new AsyncFunction(...keys, `return ${text}`);
          result = await fn(...values);
        } else {
          const fn = new Function(...keys, `return ${text}`);
          result = fn(...values);
        }

        if (typeof result !== 'string') {
          result = util.inspect(result, { depth: 2 });
        }

        const output = truncateMessage(result, LIMITS.maxMessageLength);
        await sock.sendMessage(from, { text: output }, { quoted: msg });

      } catch (err) {
        const errorMsg = MESSAGES.eval.error.replace('{error}', err.stack || err.message);
        await sock.sendMessage(from, {
          text: truncateMessage(errorMsg, LIMITS.maxMessageLength)
        }, { quoted: msg });
      }
    }
  }
];
