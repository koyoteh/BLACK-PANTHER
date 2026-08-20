'use strict';
const axios = require('axios');

const PANTHER_API_URL = 'https://ktrenqecceeooyrquooc.supabase.co/functions/v1/api-proxy';
const PANTHER_API_KEY = process.env.KOYOTEH_API_KEY || '';

async function guruApi(action, payload = {}) {
    const res = await axios.post(PANTHER_API_URL, {
        apiKey: PANTHER_API_KEY,
        action,
        payload,
    }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'BlackPantherMD/2.0' },
    });
    return res.data;
}

module.exports = { guruApi };
