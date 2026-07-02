'use strict';
const axios = require('axios');

const GURU_API_URL = 'https://ktrenqecceeooyrquooc.supabase.co/functions/v1/api-proxy';
const GURU_API_KEY = process.env.GURUTECH_API_KEY || '';

async function guruApi(action, payload = {}) {
    const res = await axios.post(GURU_API_URL, {
        apiKey: GURU_API_KEY,
        action,
        payload,
    }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'BlackPantherMD/2.0' },
    });
    return res.data;
}

module.exports = { guruApi };
