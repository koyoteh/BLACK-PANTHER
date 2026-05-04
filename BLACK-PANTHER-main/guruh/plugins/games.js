'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  games.js  (2026 Design)
//  🕹️  Trivia · Riddles · Number Guess · Word Scramble
//  🎯  Fast Math · Word of the Day · Memory Challenge
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd }     = require('../../guru/handlers/loader');
const axios          = require('axios');
const config         = require('../../guru/config/settings');
const { pickRandom } = require('../../guru/utils/gmdFunctions');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

function card(title, lines, footer = config.BOT_NAME) {
    let out = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
    out    += `┃  ${title}\n`;
    out    += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
    for (const l of lines) out += `  ${l}\n`;
    out    += `\n_© ${footer}_`;
    return out;
}

// ═══════════════════════════════════════════════════════════════
//  🧠  TRIVIA  (Open Trivia DB — free)
// ═══════════════════════════════════════════════════════════════

// Per-chat active trivia session
const triviaSession = new Map();

addCmd({
    name: 'trivia',
    aliases: ['quiz'],
    desc: 'Start a trivia quiz question',
    usage: 'trivia  |  trivia <answer>',
    category: 'games',
    handler: async (ctx) => {
        const arg = ctx.text?.trim();

        // Answer existing trivia
        if (arg && triviaSession.has(ctx.from)) {
            const session = triviaSession.get(ctx.from);
            const correct = session.correct.toLowerCase();
            const given   = arg.toLowerCase().replace(/^[abcd]\.\s*/, '').trim();

            triviaSession.delete(ctx.from);

            const isCorrect = given === correct || given === session.correctLetter;
            await ctx.react(isCorrect ? '✅' : '❌');
            return ctx.reply(
                card(
                    isCorrect ? '🎉 *T R I V I A  —  C O R R E C T !*' : '😢 *T R I V I A  —  W R O N G!*',
                    [
                        isCorrect ? `🏆 Amazing! You got it right!` : `❌ Wrong answer!`,
                        `✅ Correct Answer › *${session.correct}*`,
                        '',
                        `📖 Category › _${session.category}_`,
                        `🎯 Difficulty › _${session.difficulty}_`,
                        '',
                        `💡 Type \`${config.BOT_PREFIX}trivia\` to play again!`,
                    ],
                    config.BOT_NAME
                )
            );
        }

        // Fetch a new trivia question
        await ctx.react('🧠');
        try {
            const res  = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 10000 });
            const q    = res.data.results[0];
            const he   = (s) => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
            const question   = he(q.question);
            const correct    = he(q.correct_answer);
            const incorrect  = q.incorrect_answers.map(he);
            const allAnswers = [...incorrect, correct].sort(() => Math.random() - 0.5);
            const letters    = ['A', 'B', 'C', 'D'];
            const correctLetter = letters[allAnswers.indexOf(correct)].toLowerCase();

            triviaSession.set(ctx.from, {
                correct,
                correctLetter,
                category:   he(q.category),
                difficulty: q.difficulty,
                expires:    Date.now() + 60000,
            });

            // Auto-expire after 60 s
            setTimeout(() => {
                if (triviaSession.has(ctx.from)) triviaSession.delete(ctx.from);
            }, 60000);

            const opts = allAnswers.map((a, i) => `  ${letters[i]}. ${a}`);

            await ctx.reply(
                card('🧠 *T R I V I A  C H A L L E N G E*',
                    [`📚 Category   › _${he(q.category)}_`,
                     `🎯 Difficulty › _${q.difficulty}_`,
                     '',
                     `❓ *${question}*`,
                     '',
                     ...opts,
                     '',
                     `⏰ _You have 60 seconds to answer!_`,
                     `💬 _Reply with the letter (A/B/C/D) or the answer_`,
                    ],
                    config.BOT_NAME
                )
            );
        } catch {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Could not load a trivia question. Try again shortly.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  🔢  NUMBER GUESSING GAME
// ═══════════════════════════════════════════════════════════════

const numberGames = new Map();

addCmd({
    name: 'numguess',
    aliases: ['guess', 'numgame'],
    desc: 'Guess the secret number between 1 and 100',
    usage: 'numguess  —  start game  |  numguess <number>  —  make a guess',
    category: 'games',
    handler: async (ctx) => {
        const arg = parseInt(ctx.args[0]);

        if (!numberGames.has(ctx.from) && !arg) {
            // Start a new game
            const secret  = Math.floor(Math.random() * 100) + 1;
            const maxTries = 7;
            numberGames.set(ctx.from, { secret, tries: 0, maxTries });
            return ctx.reply(
                card('🔢 *N U M B E R  G U E S S I N G  G A M E*',
                    [`🎯 I have chosen a number between *1 and 100*!`,
                     `🎮 You have *${maxTries} attempts* to guess it.`,
                     '',
                     `💬 _Type_ \`${config.BOT_PREFIX}numguess <number>\` _to guess!_`,
                    ],
                    config.BOT_NAME
                )
            );
        }

        if (!numberGames.has(ctx.from)) {
            return ctx.reply(`❌ No active game. Type \`${config.BOT_PREFIX}numguess\` to start!`);
        }

        if (!arg || arg < 1 || arg > 100) return ctx.sock.sendMessage(ctx.from, { text: '❌ Enter a number between 1 and 100.', contextInfo: channelCtx() }, { quoted: ctx.m });

        const game = numberGames.get(ctx.from);
        game.tries++;

        if (arg === game.secret) {
            numberGames.delete(ctx.from);
            const star = game.tries <= 3 ? '🌟🌟🌟' : game.tries <= 5 ? '⭐⭐' : '⭐';
            await ctx.react('🎉');
            return ctx.reply(
                card('🎉 *Y O U  W I N !*',
                    [`✅ *${arg}* is correct! Congratulations!`,
                     '',
                     `🎯 Guesses Used › *${game.tries} / ${game.maxTries}*`,
                     `${star} _${game.tries <= 3 ? 'Genius! Incredible instincts!' : game.tries <= 5 ? 'Well played!' : 'You got there!'}_`,
                     '',
                     `💬 Type \`${config.BOT_PREFIX}numguess\` to play again!`,
                    ],
                    config.BOT_NAME
                )
            );
        }

        const remaining = game.maxTries - game.tries;
        if (remaining === 0) {
            numberGames.delete(ctx.from);
            await ctx.react('😢');
            return ctx.reply(
                card('💀 *G A M E  O V E R*',
                    [`❌ You ran out of guesses!`,
                     `🎯 The secret number was › *${game.secret}*`,
                     '',
                     `💬 Type \`${config.BOT_PREFIX}numguess\` to try again!`,
                    ],
                    config.BOT_NAME
                )
            );
        }

        const hint = arg < game.secret ? '📈 *Too LOW!* Go higher!' : '📉 *Too HIGH!* Go lower!';
        const heat  = remaining <= 2 ? '🔥 _Getting hot!_' : remaining <= 4 ? '🌡️ _Warm..._' : '❄️ _Cool..._';
        await ctx.reply(
            card('🔢 *N U M B E R  G U E S S*',
                [`Your guess › *${arg}*`,
                 `${hint}`,
                 '',
                 `🎮 Attempts left › *${remaining}*`,
                 `${heat}`,
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  🔤  WORD SCRAMBLE
// ═══════════════════════════════════════════════════════════════

const WORD_LIST = [
    'elephant','basketball','television','adventure','knowledge','language',
    'chocolate','butterfly','friendship','beautiful','computer','sunshine',
    'rainforest','saxophone','gymnasium','hurricane','telescope','waterfall',
    'algorithm','democracy','philosophy','chemistry','geography','astronomy',
    'celebrate','excellent','fantastic','gorgeous','happiness','incredible',
];

const scrambleGames = new Map();

addCmd({
    name: 'scramble',
    aliases: ['wordscramble', 'unscramble'],
    desc: 'Unscramble the jumbled word',
    usage: 'scramble  —  new word  |  scramble <answer>  —  answer',
    category: 'games',
    handler: async (ctx) => {
        const arg = ctx.text?.trim()?.toLowerCase();

        // Answer existing game
        if (arg && scrambleGames.has(ctx.from)) {
            const game = scrambleGames.get(ctx.from);
            if (arg === game.word) {
                scrambleGames.delete(ctx.from);
                await ctx.react('🎉');
                return ctx.reply(
                    card('🎉 *S C R A M B L E  —  C O R R E C T !*',
                        [`✅ *"${game.word}"* is right! Well done!`,
                         '',
                         `💬 Type \`${config.BOT_PREFIX}scramble\` for another!`,
                        ],
                        config.BOT_NAME
                    )
                );
            } else {
                await ctx.react('❌');
                return ctx.reply(
                    card('❌ *S C R A M B L E  —  W R O N G*',
                        [`❌ *"${arg}"* is not correct. Try again!`,
                         `🔤 Scrambled: *${game.scrambled}*`,
                         `💡 _Hint: ${game.word.length} letters_`,
                        ],
                        config.BOT_NAME
                    )
                );
            }
        }

        // Start new scramble
        const word      = pickRandom(WORD_LIST);
        const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
        scrambleGames.set(ctx.from, { word, scrambled });

        setTimeout(() => {
            if (scrambleGames.has(ctx.from)) scrambleGames.delete(ctx.from);
        }, 120000);

        await ctx.reply(
            card('🔤 *W O R D  S C R A M B L E*',
                [`🔀 Unscramble this word:`,
                 ``,
                 `  *${scrambled.toUpperCase()}*`,
                 '',
                 `📏 Letters › *${word.length}*`,
                 `⏰ _You have 2 minutes to answer!_`,
                 `💬 _Reply with_ \`${config.BOT_PREFIX}scramble <your answer>\``,
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  💡  RIDDLE
// ═══════════════════════════════════════════════════════════════

const RIDDLES = [
    { q: 'I have cities but no houses. I have mountains but no trees. I have water but no fish. I have roads but no cars. What am I?', a: 'a map' },
    { q: 'The more you take, the more you leave behind. What am I?', a: 'footsteps' },
    { q: 'I speak without a mouth and hear without ears. I have no body but come alive with the wind. What am I?', a: 'an echo' },
    { q: 'I have hands but cannot clap. What am I?', a: 'a clock' },
    { q: 'What can travel around the world while staying in a corner?', a: 'a stamp' },
    { q: 'I can be cracked, made, told, and played. What am I?', a: 'a joke' },
    { q: 'What has a head and a tail but no body?', a: 'a coin' },
    { q: 'I\'m light as a feather, but even the world\'s strongest man can\'t hold me for much more than a minute. What am I?', a: 'breath' },
    { q: 'What gets wetter the more it dries?', a: 'a towel' },
    { q: 'What has many keys but can\'t open a single lock?', a: 'a piano' },
    { q: 'I go up but never come down. What am I?', a: 'your age' },
    { q: 'The more of me there is, the less you can see. What am I?', a: 'darkness' },
];

const riddleGames = new Map();

addCmd({
    name: 'riddle',
    aliases: ['brain', 'puzzle'],
    desc: 'Get a brain-teaser riddle',
    usage: 'riddle  —  get riddle  |  riddle <answer>',
    category: 'games',
    handler: async (ctx) => {
        const arg = ctx.text?.trim()?.toLowerCase();

        // Answer existing riddle
        if (arg && riddleGames.has(ctx.from)) {
            const game = riddleGames.get(ctx.from);
            const isCorrect = game.answer.includes(arg) || arg.includes(game.answer.replace(/^a(n)? /, ''));
            riddleGames.delete(ctx.from);
            await ctx.react(isCorrect ? '🎉' : '❌');
            return ctx.reply(
                card(
                    isCorrect ? '🎉 *R I D D L E  —  C O R R E C T !*' : '🤔 *R I D D L E  —  N O T  Q U I T E*',
                    [
                        isCorrect ? '✅ Brilliant! You solved it!' : '❌ Not quite, but good try!',
                        `💡 Answer › *${game.answer}*`,
                        '',
                        `💬 Type \`${config.BOT_PREFIX}riddle\` for another!`,
                    ],
                    config.BOT_NAME
                )
            );
        }

        // New riddle
        const r = pickRandom(RIDDLES);
        riddleGames.set(ctx.from, { answer: r.a });
        setTimeout(() => riddleGames.delete(ctx.from), 120000);

        await ctx.reply(
            card('💡 *R I D D L E  C H A L L E N G E*',
                [`🤔 *${r.q}*`, '',
                 `⏰ _You have 2 minutes to answer!_`,
                 `💬 _Reply with_ \`${config.BOT_PREFIX}riddle <your answer>\``,
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  ⚡  FAST MATH
// ═══════════════════════════════════════════════════════════════

const mathGames = new Map();

addCmd({
    name: 'fastmath',
    aliases: ['mathgame', 'mathquiz'],
    desc: 'Solve a random math problem as fast as you can!',
    usage: 'fastmath  —  start  |  fastmath <answer>  —  answer',
    category: 'games',
    handler: async (ctx) => {
        const arg = ctx.text?.trim();

        // Check answer
        if (arg && mathGames.has(ctx.from)) {
            const game = mathGames.get(ctx.from);
            const timeTaken = ((Date.now() - game.startTime) / 1000).toFixed(2);
            mathGames.delete(ctx.from);

            if (parseInt(arg) === game.answer) {
                await ctx.react('⚡');
                const speed = timeTaken < 5 ? '🚀 Lightning fast!' : timeTaken < 15 ? '⚡ Very quick!' : '✅ Got it!';
                return ctx.reply(
                    card('⚡ *F A S T  M A T H  —  C O R R E C T !*',
                        [`✅ *${game.answer}* is right!`,
                         `⏱️ Time Taken › *${timeTaken} seconds*`,
                         `${speed}`,
                         '',
                         `💬 Type \`${config.BOT_PREFIX}fastmath\` for another!`,
                        ],
                        config.BOT_NAME
                    )
                );
            } else {
                await ctx.react('❌');
                return ctx.reply(
                    card('❌ *F A S T  M A T H  —  W R O N G*',
                        [`❌ Your answer › *${arg}*`,
                         `✅ Correct answer › *${game.answer}*`,
                         `⏱️ Time › *${timeTaken}s*`,
                         '',
                         `💬 Type \`${config.BOT_PREFIX}fastmath\` to try again!`,
                        ],
                        config.BOT_NAME
                    )
                );
            }
        }

        // Generate new problem
        const ops  = ['+', '-', '×', '÷'];
        const op   = pickRandom(ops);
        let a, b, answer, expr;

        switch (op) {
            case '+': a = Math.floor(Math.random()*100)+1; b = Math.floor(Math.random()*100)+1; answer = a+b; expr = `${a} + ${b}`; break;
            case '-': a = Math.floor(Math.random()*100)+50; b = Math.floor(Math.random()*50)+1; answer = a-b; expr = `${a} - ${b}`; break;
            case '×': a = Math.floor(Math.random()*12)+2; b = Math.floor(Math.random()*12)+2; answer = a*b; expr = `${a} × ${b}`; break;
            case '÷': b = Math.floor(Math.random()*11)+2; answer = Math.floor(Math.random()*11)+2; a = b*answer; expr = `${a} ÷ ${b}`; break;
        }

        mathGames.set(ctx.from, { answer, startTime: Date.now() });
        setTimeout(() => mathGames.delete(ctx.from), 60000);

        await ctx.reply(
            card('⚡ *F A S T  M A T H*',
                [`🧮 Solve this fast:`,
                 '',
                 `  *${expr} = ?*`,
                 '',
                 `⏰ _Timer started! Reply with your answer!_`,
                 `💬 \`${config.BOT_PREFIX}fastmath <number>\``,
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  🎯  TRUTH OR DARE (enhanced)
// ═══════════════════════════════════════════════════════════════

const TRUTHS_2026 = [
    'What is the most embarrassing thing you\'ve ever done in public?',
    'Have you ever lied to your best friend? About what?',
    'What is your biggest insecurity right now?',
    'Who in this chat do you find most attractive?',
    'What is something you\'ve never told anyone?',
    'What was your most awkward date experience?',
    'What is the most childish thing you still do?',
    'Have you ever cheated in a relationship or exam?',
    'What is your biggest fear in life?',
    'What habit of yours would shock people if they knew?',
    'What is the biggest mistake you\'ve made and learned from?',
    'Who do you secretly dislike in this group?',
];

const DARES_2026 = [
    'Send a voice note singing the chorus of your current favourite song! 🎤',
    'Change your WhatsApp status to "I\'m a bot" for the next hour! 🤖',
    'Send a *voice note* speaking in a funny accent for 30 seconds! 🎭',
    'Tag 3 people in this chat and compliment each one genuinely! 💌',
    'Send the last photo in your gallery right now! 📸',
    'Record yourself doing 10 jumping jacks and send the video! 🏃',
    'Write a 3-sentence love letter to your phone! 📱',
    'Send a voice note explaining your week as a news reporter! 📺',
    'Set your profile picture to a selfie making a funny face for 30 mins! 😜',
    'Send a motivational speech voice note (at least 30 seconds)! 🎙️',
    'Text your mum or dad "I love you so much" right now and screenshot it! 💖',
    'Speak in rhymes for your next 3 messages in this chat! 🎶',
];

addCmd({
    name: 'tod',
    aliases: ['truthordare', 'tordare'],
    desc: 'Play truth or dare!',
    usage: 'tod truth  |  tod dare',
    category: 'games',
    handler: async (ctx) => {
        const choice = ctx.args[0]?.toLowerCase();
        if (!choice || !['truth', 'dare'].includes(choice)) {
            return ctx.reply(
                card('🎭 *T R U T H  O R  D A R E*',
                    [`Choose your challenge:`,
                     '',
                     `  🔮 \`${config.BOT_PREFIX}tod truth\`  — face a deep question`,
                     `  🎯 \`${config.BOT_PREFIX}tod dare\`   — complete a daring task`,
                     '',
                     `_Do you have the courage? 😏_`,
                    ],
                    config.BOT_NAME
                )
            );
        }

        if (choice === 'truth') {
            await ctx.reply(
                card('🔮 *T R U T H*',
                    [`❓ *${pickRandom(TRUTHS_2026)}*`,
                     '',
                     `_Honesty is the best policy... or is it? 😏_`,
                    ],
                    config.BOT_NAME
                )
            );
        } else {
            await ctx.reply(
                card('🎯 *D A R E*',
                    [`🔥 *${pickRandom(DARES_2026)}*`,
                     '',
                     `_Do it or lose your honour! 😂_`,
                    ],
                    config.BOT_NAME
                )
            );
        }
    },
});
