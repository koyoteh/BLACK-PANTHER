export function createMessageDiagnostics() {
  return {
    upsertBatches: 0,
    messagesSeen: 0,
    messagesWithoutPayload: 0,
    lastUpsertAt: null,
    lastUpsertType: null,
    lastMessageAt: null
  }
}

export function recordMessageUpsert(diagnostics, event, at = new Date().toISOString()) {
  const messages = Array.isArray(event?.messages) ? event.messages : []
  if (!diagnostics) return messages

  diagnostics.upsertBatches += 1
  diagnostics.messagesSeen += messages.length
  diagnostics.messagesWithoutPayload += messages.filter(message => !message?.message).length
  diagnostics.lastUpsertAt = at
  diagnostics.lastUpsertType = typeof event?.type === 'string' ? event.type : null
  if (messages.length) diagnostics.lastMessageAt = at
  return messages
}
