export function extractCommandText(message, depth = 0) {
    if (!message || typeof message !== 'object' || depth > 8) return '';
    const directText = [
        message.conversation,
        message.extendedTextMessage?.text,
        message.imageMessage?.caption,
        message.videoMessage?.caption,
        message.documentMessage?.caption
    ].find(value => typeof value === 'string' && value.trim());
    if (directText) return directText;

    for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'deviceSentMessage', 'documentWithCaptionMessage']) {
        if (message[key]?.message) {
            const nested = extractCommandText(message[key].message, depth + 1);
            if (nested) return nested;
        }
    }
    return '';
}

export function isPrefixedBotCommand(text, commandNames) {
    const match = String(text || '').match(/^\s*[.!#/$?+*~@%&^=|\\-]+\s*([a-z][a-z0-9_-]*)(?=$|\s|[^\p{L}\p{N}_-])/iu);
    const command = match?.[1]?.toLowerCase();
    return !!command && !!commandNames?.has(command);
}

export function canEnforceBotCommand(botIsAdmin, senderIsAdmin) {
    return Boolean(botIsAdmin) && !Boolean(senderIsAdmin);
}
