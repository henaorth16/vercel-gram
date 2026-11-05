export interface UpdateMetadata {
  update_id?: number;
  update_type: string;
  chat_id?: string;
  user_id?: string;
  command?: string;
}

/**
 * Safely extracts metadata from any Telegram update object without assuming
 * `message.text` is present.
 *
 * Handles:
 * - message
 * - callback_query
 * - edited_message
 * - channel_post
 * - edited_channel_post
 * - my_chat_member
 * - chat_member
 * - inline_query
 */
export function extractUpdateMetadata(update: any): UpdateMetadata {
  if (!update || typeof update !== 'object') {
    return {
      update_type: 'unknown',
    };
  }

  const updateId = typeof update.update_id === 'number' ? update.update_id : undefined;

  // 1. message
  if (update.message) {
    const msg = update.message;
    const text = typeof msg.text === 'string' ? msg.text : undefined;
    const command = text?.startsWith('/') ? text.split(/\s+/)[0].split('@')[0] : undefined;
    return {
      update_id: updateId,
      update_type: 'message',
      chat_id: msg.chat?.id !== undefined ? String(msg.chat.id) : undefined,
      user_id: msg.from?.id !== undefined ? String(msg.from.id) : undefined,
      command,
    };
  }

  // 2. callback_query
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = typeof cb.data === 'string' ? cb.data : undefined;
    const command = data ? `callback:${data.split(':')[0]}` : 'callback_query';
    return {
      update_id: updateId,
      update_type: 'callback_query',
      chat_id: cb.message?.chat?.id !== undefined ? String(cb.message.chat.id) : undefined,
      user_id: cb.from?.id !== undefined ? String(cb.from.id) : undefined,
      command,
    };
  }

  // 3. edited_message
  if (update.edited_message) {
    const em = update.edited_message;
    const text = typeof em.text === 'string' ? em.text : undefined;
    const command = text?.startsWith('/') ? text.split(/\s+/)[0].split('@')[0] : undefined;
    return {
      update_id: updateId,
      update_type: 'edited_message',
      chat_id: em.chat?.id !== undefined ? String(em.chat.id) : undefined,
      user_id: em.from?.id !== undefined ? String(em.from.id) : undefined,
      command,
    };
  }

  // 4. channel_post
  if (update.channel_post) {
    const cp = update.channel_post;
    const text = typeof cp.text === 'string' ? cp.text : undefined;
    const command = text?.startsWith('/') ? text.split(/\s+/)[0].split('@')[0] : undefined;
    return {
      update_id: updateId,
      update_type: 'channel_post',
      chat_id: cp.chat?.id !== undefined ? String(cp.chat.id) : undefined,
      command,
    };
  }

  // 5. edited_channel_post
  if (update.edited_channel_post) {
    const ecp = update.edited_channel_post;
    return {
      update_id: updateId,
      update_type: 'edited_channel_post',
      chat_id: ecp.chat?.id !== undefined ? String(ecp.chat.id) : undefined,
    };
  }

  // 6. my_chat_member
  if (update.my_chat_member) {
    const mcm = update.my_chat_member;
    return {
      update_id: updateId,
      update_type: 'my_chat_member',
      chat_id: mcm.chat?.id !== undefined ? String(mcm.chat.id) : undefined,
      user_id: mcm.from?.id !== undefined ? String(mcm.from.id) : undefined,
      command: 'chat_member_status_change',
    };
  }

  // 7. chat_member
  if (update.chat_member) {
    const cm = update.chat_member;
    return {
      update_id: updateId,
      update_type: 'chat_member',
      chat_id: cm.chat?.id !== undefined ? String(cm.chat.id) : undefined,
      user_id: cm.from?.id !== undefined ? String(cm.from.id) : undefined,
    };
  }

  // 8. inline_query
  if (update.inline_query) {
    const iq = update.inline_query;
    return {
      update_id: updateId,
      update_type: 'inline_query',
      user_id: iq.from?.id !== undefined ? String(iq.from.id) : undefined,
      command: 'inline_query',
    };
  }

  // Fallback for any other update types
  const detectedType = Object.keys(update).find((k) => k !== 'update_id') || 'unknown';
  return {
    update_id: updateId,
    update_type: detectedType,
  };
}
