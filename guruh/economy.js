const { gmd } = require("../guru");
const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs-extra");

// ═══════════════════════════════════════════════════════════════════
//  GROUP ECONOMY ENGINE  ·  BLACK PANTHER MD
//  Virtual GURU Coins — earn, spend, transfer, gamble, leaderboard.
//  Passive chat rewards · Daily bonus · Anti-abuse cooldowns.
// ═══════════════════════════════════════════════════════════════════

const DB_DIR = path.join(__dirname, "../guru/database");
fs.ensureDirSync(DB_DIR);

const db = new Database(path.join(DB_DIR, "economy.db"));
db.pragma("journal_mode = WAL");
db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
        jid           TEXT    PRIMARY KEY,
        display_name  TEXT,
        balance       INTEGER NOT NULL DEFAULT 500,
        total_earned  INTEGER NOT NULL DEFAULT 500,
        total_spent   INTEGER NOT NULL DEFAULT 0,
        created_at    INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        from_jid   TEXT,
        to_jid     TEXT    NOT NULL,
        amount     INTEGER NOT NULL,
        type       TEXT    NOT NULL,
        note       TEXT,
        created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_claims (
        jid        TEXT    PRIMARY KEY,
        claimed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_earn_cd (
        jid        TEXT    PRIMARY KEY,
        next_earn  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gamble_cd (
        jid        TEXT    PRIMARY KEY,
        next_gamble INTEGER NOT NULL
    );
`);

// ── Prepared statements ────────────────────────────────────────────
const $getWallet  = db.prepare(`SELECT * FROM wallets WHERE jid = ?`);
const $initWallet = db.prepare(
    `INSERT OR IGNORE INTO wallets (jid,display_name,balance,total_earned,total_spent,created_at)
     VALUES (?,?,500,500,0,?)`
);
const $updateBal  = db.prepare(`UPDATE wallets SET balance = balance + ?, display_name = ? WHERE jid = ?`);
const $addEarned  = db.prepare(`UPDATE wallets SET total_earned = total_earned + ? WHERE jid = ?`);
const $addSpent   = db.prepare(`UPDATE wallets SET total_spent  = total_spent  + ? WHERE jid = ?`);
const $logTx      = db.prepare(
    `INSERT INTO transactions (from_jid,to_jid,amount,type,note,created_at)
     VALUES (?,?,?,?,?,?)`
);
const $getDaily   = db.prepare(`SELECT claimed_at FROM daily_claims WHERE jid = ?`);
const $setDaily   = db.prepare(`INSERT OR REPLACE INTO daily_claims (jid,claimed_at) VALUES (?,?)`);
const $getChatCd  = db.prepare(`SELECT next_earn  FROM chat_earn_cd  WHERE jid = ?`);
const $setChatCd  = db.prepare(`INSERT OR REPLACE INTO chat_earn_cd  (jid,next_earn)   VALUES (?,?)`);
const $getGambleCd= db.prepare(`SELECT next_gamble FROM gamble_cd    WHERE jid = ?`);
const $setGambleCd= db.prepare(`INSERT OR REPLACE INTO gamble_cd    (jid,next_gamble) VALUES (?,?)`);
const $leaderboard= db.prepare(`SELECT jid,display_name,balance FROM wallets ORDER BY balance DESC LIMIT 10`);

// ── Core helpers ──────────────────────────────────────────────────
const ensureWallet = (jid, name = null) => {
    $initWallet.run(jid, name || jid.split("@")[0], Date.now());
};

const getBalance = (jid) => {
    const row = $getWallet.get(jid);
    return row ? row.balance : 500;
};

const transfer = db.transaction((fromJid, toJid, amount, type, note) => {
    $updateBal.run(-amount, null, fromJid);
    $addSpent.run(amount, fromJid);
    $updateBal.run( amount, null, toJid);
    $addEarned.run(amount, toJid);
    $logTx.run(fromJid, toJid, amount, type, note, Date.now());
});

const award = (jid, amount, type, note, name = null) => {
    $updateBal.run(amount, name, jid);
    $addEarned.run(amount, jid);
    $logTx.run(null, jid, amount, type, note, Date.now());
};

// ── Rank system ───────────────────────────────────────────────────
const getRank = (bal) => {
    if (bal <    500) return { icon: "🌱", title: "Newcomer"  };
    if (bal <  2_000) return { icon: "⭐", title: "Member"    };
    if (bal <  5_000) return { icon: "💫", title: "Regular"   };
    if (bal < 10_000) return { icon: "🔥", title: "Veteran"   };
    if (bal < 25_000) return { icon: "💎", title: "Elite"     };
    if (bal < 50_000) return { icon: "👑", title: "Legend"    };
    return                    { icon: "🏆", title: "GURU Lord" };
};

const fmt = (n) => n.toLocaleString();

// ── Passive chat-activity coin rewards ────────────────────────────
if (!global.__pluginMsgHooks) global.__pluginMsgHooks = [];

global.__pluginMsgHooks.push(async (ms, Guru, settings) => {
    try {
        const from = ms.key.remoteJid;
        if (!from?.endsWith("@g.us")) return; // groups only

        const body = (
            ms.message?.conversation ||
            ms.message?.extendedTextMessage?.text || ""
        ).trim();
        const prefix = settings?.PREFIX || ".";
        if (!body || body.startsWith(prefix) || body.length < 3) return;

        const jid  = ms.key.participant || from;
        const name = ms.pushName || jid.split("@")[0];
        const now  = Date.now();

        const cd = $getChatCd.get(jid);
        if (cd && cd.next_earn > now) return; // still on cooldown

        ensureWallet(jid, name);
        const coins = Math.floor(Math.random() * 3) + 1; // 1–3 coins per message
        $updateBal.run(coins, name, jid);
        $addEarned.run(coins, jid);
        $setChatCd.run(jid, now + 5 * 60_000); // 5-min chat cooldown
    } catch (err) {
        console.error("[Economy] passive hook error:", err.message);
    }
});

// ── COMMAND: .balance ─────────────────────────────────────────────
gmd({
    pattern:     "balance",
    aliases:     ["bal", "wallet", "coins", "mycoins"],
    react:       "💰",
    category:    "economy",
    description: "Check your GURU Coin wallet",
    usage:       ".balance",
}, async (from, Guru, conText) => {
    const { reply, react, sender, pushName, mek } = conText;

    const jid  = sender;
    const name = pushName || jid.split("@")[0];
    ensureWallet(jid, name);

    const row  = $getWallet.get(jid);
    const rank = getRank(row.balance);
    const daily= $getDaily.get(jid);
    const canDaily = !daily || (Date.now() - daily.claimed_at) >= 86_400_000;

    await react("✅");
    reply(
        `*💰 GURU Coins Wallet*\n` +
        `${"═".repeat(30)}\n\n` +
        `👤 *${name}*\n` +
        `${rank.icon} *Rank:* ${rank.title}\n\n` +
        `💰 *Balance:*      \`${fmt(row.balance)} coins\`\n` +
        `📈 *Total Earned:* \`${fmt(row.total_earned)} coins\`\n` +
        `📉 *Total Spent:*  \`${fmt(row.total_spent)} coins\`\n\n` +
        `${"─".repeat(30)}\n` +
        `🎁 *Daily Bonus:* ${canDaily ? "✅ Available! Use `.daily`" : "⏳ Already claimed today"}\n\n` +
        `> _Earn coins by chatting in groups (1–3 per msg, 5min cooldown)_`
    );
});

// ── COMMAND: .daily ───────────────────────────────────────────────
gmd({
    pattern:     "daily",
    aliases:     ["dailybonus", "claim"],
    react:       "🎁",
    category:    "economy",
    description: "Claim your daily GURU Coin bonus",
    usage:       ".daily",
}, async (from, Guru, conText) => {
    const { reply, react, sender, pushName } = conText;

    const jid  = sender;
    const name = pushName || jid.split("@")[0];
    ensureWallet(jid, name);

    const daily = $getDaily.get(jid);
    const now   = Date.now();
    const CD    = 86_400_000; // 24 hours

    if (daily && now - daily.claimed_at < CD) {
        const left = CD - (now - daily.claimed_at);
        const hrs  = Math.floor(left / 3_600_000);
        const mins = Math.floor((left % 3_600_000) / 60_000);
        await react("⏳");
        return reply(`⏳ Already claimed!\n\nNext daily in: *${hrs}h ${mins}m*`);
    }

    // Bonus: base 100–500, streak bonus if claimed yesterday
    const base   = Math.floor(Math.random() * 401) + 100;
    const streak = daily && now - daily.claimed_at < CD * 2 ? Math.floor(base * 0.25) : 0;
    const total  = base + streak;

    $setDaily.run(jid, now);
    award(jid, total, "daily", "daily bonus", name);

    const newBal = getBalance(jid);
    const rank   = getRank(newBal);

    await react("🎉");
    reply(
        `*🎁 Daily Bonus Claimed!*\n` +
        `${"═".repeat(30)}\n\n` +
        `✨ *Base reward:*   +${fmt(base)} coins\n` +
        (streak ? `🔥 *Streak bonus:*  +${fmt(streak)} coins\n` : "") +
        `${"─".repeat(30)}\n` +
        `🪙 *Total earned:* +${fmt(total)} coins\n\n` +
        `💰 *New balance:* ${fmt(newBal)} coins\n` +
        `${rank.icon} *Rank:* ${rank.title}\n\n` +
        `> _Come back in 24 hours for tomorrow's bonus!_`
    );
});

// ── COMMAND: .give ────────────────────────────────────────────────
gmd({
    pattern:     "give",
    aliases:     ["transfer", "send", "pay"],
    react:       "💸",
    category:    "economy",
    description: "Send GURU Coins to another member",
    usage:       ".give @user <amount>",
}, async (from, Guru, conText) => {
    const { q, reply, react, sender, pushName, mek } = conText;

    if (!q) {
        await react("❓");
        return reply("❓ Usage: `.give @user <amount>`\n\nExample: `.give @John 100`");
    }

    // Parse quoted mention or @number
    const mentioned = mek?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                   || mek?.message?.extendedTextMessage?.contextInfo?.quotedParticipant;
    const nums      = q.match(/\d+/g) || [];
    const amount    = parseInt(nums[nums.length - 1], 10);

    if (!mentioned || isNaN(amount) || amount <= 0) {
        await react("❌");
        return reply("❌ Usage: `.give @user <amount>`\n\nMention someone and specify a positive amount.");
    }
    if (mentioned === sender) {
        await react("❌");
        return reply("❌ You can't send coins to yourself!");
    }
    if (amount < 10) {
        await react("❌");
        return reply("❌ Minimum transfer is *10 coins*.");
    }

    const jid  = sender;
    const name = pushName || jid.split("@")[0];
    ensureWallet(jid, name);
    ensureWallet(mentioned);

    const bal = getBalance(jid);
    if (bal < amount) {
        await react("❌");
        return reply(`❌ Insufficient balance!\n\n💰 Your balance: *${fmt(bal)} coins*\n💸 You tried to send: *${fmt(amount)} coins*`);
    }

    transfer(jid, mentioned, amount, "transfer", `sent by ${name}`);

    const recipientNum = mentioned.split("@")[0];
    await react("✅");
    reply(
        `*💸 Transfer Complete!*\n${"─".repeat(28)}\n\n` +
        `📤 *From:* ${name}\n` +
        `📥 *To:*   @${recipientNum}\n` +
        `💰 *Amount:* ${fmt(amount)} coins\n\n` +
        `💼 *Your new balance:* ${fmt(getBalance(jid))} coins`
    );
});

// ── COMMAND: .gamble ──────────────────────────────────────────────
gmd({
    pattern:     "gamble",
    aliases:     ["bet", "flip", "casino"],
    react:       "🎰",
    category:    "economy",
    description: "Gamble your GURU Coins (50/50 win 2×, lose 0.5×)",
    usage:       ".gamble <amount | all | half>",
}, async (from, Guru, conText) => {
    const { q, reply, react, sender, pushName } = conText;

    if (!q) {
        await react("❓");
        return reply(
            `*🎰 GURU Casino*\n${"═".repeat(28)}\n\n` +
            `*Usage:* \`.gamble <amount | all | half>\`\n\n` +
            `• Win: double your bet 🤑\n` +
            `• Lose: lose half your bet 😢\n` +
            `• Min bet: 10 coins\n` +
            `• Max bet: 10,000 coins\n` +
            `• Cooldown: 30 seconds`
        );
    }

    const jid  = sender;
    const name = pushName || jid.split("@")[0];
    ensureWallet(jid, name);

    const cd  = $getGambleCd.get(jid);
    const now = Date.now();
    if (cd && cd.next_gamble > now) {
        const secs = Math.ceil((cd.next_gamble - now) / 1000);
        await react("⏳");
        return reply(`⏳ Gamble cooldown: *${secs}s* remaining.`);
    }

    const bal   = getBalance(jid);
    let   stake;
    const input = q.trim().toLowerCase();

    if      (input === "all")  stake = bal;
    else if (input === "half") stake = Math.floor(bal / 2);
    else                       stake = parseInt(input, 10);

    if (isNaN(stake) || stake < 10) {
        await react("❌");
        return reply("❌ Minimum bet is *10 coins*.");
    }
    stake = Math.min(stake, 10_000, bal);
    if (stake < 10) {
        await react("❌");
        return reply(`❌ You don't have enough coins! Balance: *${fmt(bal)}*`);
    }

    $setGambleCd.run(jid, now + 30_000);

    // Simulate: dice 1-100. >50 = win, else lose
    const roll = Math.floor(Math.random() * 100) + 1;
    const win  = roll > 50;

    if (win) {
        award(jid, stake, "gamble_win", `won gamble (roll ${roll})`, name);
        const newBal = getBalance(jid);
        await react("🤑");
        reply(
            `*🎰 CASINO — YOU WON!*\n${"═".repeat(30)}\n\n` +
            `🎲 *Roll:* ${roll}/100\n` +
            `💰 *Bet:*  ${fmt(stake)} coins\n` +
            `🏆 *Won:*  +${fmt(stake)} coins\n\n` +
            `${"─".repeat(30)}\n` +
            `💼 *New Balance:* ${fmt(newBal)} coins 🤑`
        );
    } else {
        const lose = Math.floor(stake * 0.5);
        const loseActual = Math.min(lose, bal);
        $updateBal.run(-loseActual, name, jid);
        $addSpent.run(loseActual, jid);
        $logTx.run(jid, null, loseActual, "gamble_loss", `lost gamble (roll ${roll})`, now);
        const newBal = getBalance(jid);
        await react("😢");
        reply(
            `*🎰 CASINO — YOU LOST*\n${"═".repeat(30)}\n\n` +
            `🎲 *Roll:* ${roll}/100\n` +
            `💰 *Bet:*   ${fmt(stake)} coins\n` +
            `💸 *Lost:*  −${fmt(loseActual)} coins (half)\n\n` +
            `${"─".repeat(30)}\n` +
            `💼 *New Balance:* ${fmt(newBal)} coins 😢`
        );
    }
});

// ── COMMAND: .leaderboard ─────────────────────────────────────────
gmd({
    pattern:     "leaderboard",
    aliases:     ["rich", "top10", "richlist", "econboard"],
    react:       "🏆",
    category:    "economy",
    description: "Top 10 richest GURU Coin holders",
    usage:       ".leaderboard",
}, async (from, Guru, conText) => {
    const { reply, react, sender } = conText;

    const rows  = $leaderboard.all();
    if (rows.length === 0) {
        await react("📭");
        return reply("📭 No wallets yet. Start chatting to earn coins!");
    }

    const MEDALS = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    const lines  = rows.map((r, i) => {
        const rank  = getRank(r.balance);
        const you   = r.jid === sender ? " _(you)_" : "";
        const dname = r.display_name || r.jid.split("@")[0];
        return `${MEDALS[i]} ${rank.icon} *${dname}*${you}\n   💰 \`${fmt(r.balance)} coins\` — ${rank.title}`;
    }).join("\n\n");

    const myRow = rows.find(r => r.jid === sender);
    const myPos = myRow ? rows.indexOf(myRow) + 1 : null;

    await react("✅");
    reply(
        `*🏆 GURU Coins Leaderboard*\n${"═".repeat(32)}\n\n` +
        `${lines}\n\n` +
        `${"─".repeat(32)}\n` +
        (myPos
            ? `📍 *Your position:* #${myPos} — ${fmt(myRow.balance)} coins`
            : `💡 _Chat in groups to earn coins & join the board!_`)
    );
});

// ── COMMAND: .coininfo ────────────────────────────────────────────
gmd({
    pattern:     "coininfo",
    aliases:     ["econhelp", "coinshelp"],
    react:       "ℹ️",
    category:    "economy",
    description: "How the GURU Coin economy works",
    usage:       ".coininfo",
}, async (from, Guru, conText) => {
    const { reply, react } = conText;
    await react("✅");
    reply(
        `*💰 GURU Coin Economy — Guide*\n${"═".repeat(32)}\n\n` +
        `*Earning Coins:*\n` +
        `🗨️ Chat in groups → +1–3 coins _(5min cooldown)_\n` +
        `🎁 \`.daily\` → +100–500 coins _(every 24h)_\n` +
        `🎰 \`.gamble\` → Win 2× your bet _(risk: lose 0.5×)_\n\n` +
        `*Spending / Sending:*\n` +
        `💸 \`.give @user <amount>\` — Transfer coins\n\n` +
        `*Ranks by Balance:*\n` +
        `🌱 Newcomer   < 500\n` +
        `⭐ Member     < 2,000\n` +
        `💫 Regular    < 5,000\n` +
        `🔥 Veteran    < 10,000\n` +
        `💎 Elite      < 25,000\n` +
        `👑 Legend     < 50,000\n` +
        `🏆 GURU Lord  50,000+\n\n` +
        `*Commands:*\n` +
        `\`.balance\` \`.daily\` \`.give\` \`.gamble\` \`.leaderboard\``
    );
});
