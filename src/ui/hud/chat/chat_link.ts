// Chat-link token contract. A chat link is a tiny, name-free token the client embeds
// in chat text; the renderer resolves the localized name from the item table, so a
// forged label can't misrepresent the target. Pure + host-free (Vitest imports it
// directly). Only the client uses it, the sim never sees tokens.
//
// This was `hud/quest/quest_link.ts` and carried two link kinds, quests ([[q:id]])
// and items ([[i:id]]), through one parser so a message could mix them. The quest
// kind went with the quest system; the item kind never had anything to do with it
// and lives on here, in the chat domain that actually consumes it.
//
// The parser still RECOGNISES the `q` prefix and renders it as plain text rather
// than dropping it. Old chat logs and mail bodies persisted with [[q:...]] tokens
// in them, and a parser that silently swallowed the token would leave a sentence
// with a hole in it.

export type ChatSegment = { kind: 'text'; value: string } | { kind: 'item'; itemId: string };

// Item ids are [A-Za-z0-9_]+ (e.g. "sword_iron"). Global so we can walk every match.
const CHAT_LINK_RE = /\[\[([qi]):([A-Za-z0-9_]+)\]\]/g;

export function encodeItemLink(itemId: string): string {
  return `[[i:${itemId}]]`;
}

export function parseChatSegments(text: string): ChatSegment[] {
  const segments: ChatSegment[] = [];
  let last = 0;
  CHAT_LINK_RE.lastIndex = 0;
  let m = CHAT_LINK_RE.exec(text);
  while (m) {
    if (m.index > last) segments.push({ kind: 'text', value: text.slice(last, m.index) });
    // A stale quest token renders as its literal text, never as a link.
    segments.push(m[1] === 'i' ? { kind: 'item', itemId: m[2] } : { kind: 'text', value: m[0] });
    last = m.index + m[0].length;
    m = CHAT_LINK_RE.exec(text);
  }
  if (last < text.length || segments.length === 0)
    segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}
