import test from 'node:test';
import assert from 'node:assert/strict';

const loadFresh = async (query, env = {}) => {
    const saved = {};
    for (const [key, value] of Object.entries(env)) {
        saved[key] = process.env[key];
        process.env[key] = value;
    }
    const mod = await import(`../lib/adminNotice.js${query}`);
    for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    return mod;
};

const makeClient = () => {
    const sent = [];
    return {
        sent,
        sendMessage: async (chatId, payload) => { sent.push({ chatId, ...payload }); }
    };
};

test('the not-admin notice is silent by default', async () => {
    const { notifyMissingAdmin, adminNoticeConfig } = await loadFresh('?case=silent');
    assert.equal(adminNoticeConfig.enabled, false);

    const client = makeClient();
    const sent = await notifyMissingAdmin(client, { chat: 'silent@g.us', key: { id: 'MSG1' } }, '254700000001@s.whatsapp.net', 'nag');

    assert.equal(sent, false);
    assert.equal(client.sent.length, 0);
});

test('an enabled notice is sent at most once per chat per cooldown', async () => {
    const { notifyMissingAdmin } = await loadFresh('?case=cooldown', {
        ADMIN_NOTICE_ENABLED: 'true',
        ADMIN_NOTICE_COOLDOWN_MS: '3600000'
    });

    const client = makeClient();
    const chat = 'cooldown@g.us';
    const sender = '254700000002@s.whatsapp.net';

    const first = await notifyMissingAdmin(client, { chat, key: { id: 'A1' } }, sender, 'nag');
    const second = await notifyMissingAdmin(client, { chat, key: { id: 'A2' } }, sender, 'nag');
    const third = await notifyMissingAdmin(client, { chat, key: { id: 'A3' } }, sender, 'nag');

    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(third, false);
    assert.equal(client.sent.length, 1);
    assert.equal(client.sent[0].mentions[0], sender);
});

test('duplicate deliveries of the same message never produce a second notice', async () => {
    const { notifyMissingAdmin } = await loadFresh('?case=dedupe', {
        ADMIN_NOTICE_ENABLED: 'true',
        ADMIN_NOTICE_COOLDOWN_MS: '0'
    });

    const client = makeClient();
    const chat = 'dedupe@g.us';
    const message = { chat, key: { id: 'SAME-ID' } };

    const results = [];
    for (let i = 0; i < 13; i += 1) {
        results.push(await notifyMissingAdmin(client, message, '254700000003@s.whatsapp.net', 'nag'));
    }

    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(client.sent.length, 1);
});

test('a zero cooldown still allows one notice per distinct message', async () => {
    const { notifyMissingAdmin } = await loadFresh('?case=zero', {
        ADMIN_NOTICE_ENABLED: 'true',
        ADMIN_NOTICE_COOLDOWN_MS: '0'
    });

    const client = makeClient();
    const chat = 'zero@g.us';
    const sender = '254700000004@s.whatsapp.net';

    assert.equal(await notifyMissingAdmin(client, { chat, key: { id: 'B1' } }, sender, 'nag'), true);
    assert.equal(await notifyMissingAdmin(client, { chat, key: { id: 'B2' } }, sender, 'nag'), true);
    assert.equal(client.sent.length, 2);
});

test('canSendAdminNotice respects the configured window', async () => {
    const { canSendAdminNotice, adminNoticeConfig } = await loadFresh('?case=window', {
        ADMIN_NOTICE_COOLDOWN_MS: '60000'
    });

    assert.equal(adminNoticeConfig.cooldownMs, 60000);
    const chat = 'window@g.us';
    assert.equal(canSendAdminNotice(chat, 1_000_000), true);
    assert.equal(canSendAdminNotice(chat, 1_030_000), false);
    assert.equal(canSendAdminNotice(chat, 1_060_001), true);
});
