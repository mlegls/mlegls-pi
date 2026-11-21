type Contact = { slug: string; channels: Record<string, string> };
export type Entry = { id: string; at: string; channel: string; direction: "inbound" | "outbound"; text: string };
export type Import = { contact: Contact; entries: Entry[]; chatID?: string };

export function handle(channel: string, value: string): string {
  if (channel === "beeper_chat_id") return value;
  const s = value.trim().toLowerCase();
  return channel === "reddit" ? s.replace(/^(?:\/?u\/|@)/, "") : s.replace(/^@/, "");
}

export class BeeperOffline extends Error {}
type Chat = {
  id: string; localChatID?: string; network: string; accountID: string; type: string;
  participants?: { items: { id: string; username?: string; isSelf?: boolean }[] };
};
type BeeperMessage = {
  id: string; timestamp: string; isSender?: boolean; isDeleted?: boolean;
  isHidden?: boolean; text?: string; attachments?: unknown[];
};

function chatChannel(chat: Chat): string {
  const network = (chat.network || chat.accountID?.split(":")[0] || "").toLowerCase();
  if (/^(twitter|x)(?:\b|$)/.test(network)) return "x";
  if (/^linkedin\b/.test(network)) return "linkedin";
  return network.replace(/[^a-z0-9]+/g, "_") || "beeper";
}

export async function fromBeeper(contacts: Contact[]): Promise<Import[]> {
  if (!contacts.length) return [];
  const base = process.env.BEEPER_API_URL;
  const token = process.env.BEEPER_ACCESS_TOKEN;
  if (!base || !token) throw new Error("set BEEPER_API_URL and BEEPER_ACCESS_TOKEN");
  if (!/^https?:$/.test(new URL(base).protocol)) throw new Error("BEEPER_API_URL must use HTTP or HTTPS");

  async function pages<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const url = new URL(path, base);
      if (cursor) url.searchParams.set("cursor", cursor);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Authorization: "Bearer " + token },
          signal: AbortSignal.timeout(8000), redirect: "error",
        });
      } catch {
        throw new BeeperOffline("offline (Desktop API unreachable)");
      }
      if ([502, 503, 504].includes(res.status)) throw new BeeperOffline("offline (Desktop API unavailable)");
      if (!res.ok) throw new Error("Desktop API HTTP " + res.status);
      const page = await res.json() as { items: T[]; hasMore?: boolean; oldestCursor?: string };
      if (!Array.isArray(page.items)) throw new Error("invalid Desktop API page");
      items.push(...page.items);
      if (!page.hasMore) break;
      cursor = page.oldestCursor;
      if (!cursor || seen.has(cursor)) throw new Error("invalid Desktop API pagination cursor");
      seen.add(cursor);
    } while (cursor);
    return items;
  }

  const chats = await pages<Chat>("/v1/chats");
  const pinned = new Set(contacts.flatMap(c => c.channels.beeper_chat_id || []));
  const assigned = new Map<string, string>();
  const imports: Import[] = [];
  for (const contact of contacts) {
    const explicit = contact.channels.beeper_chat_id;
    const matches = explicit
      ? chats.filter(chat => chat.id === explicit || chat.localChatID === explicit)
      : chats.filter(chat => {
        if (chat.type !== "single" || pinned.has(chat.id) || (chat.localChatID && pinned.has(chat.localChatID))) return false;
        const channel = chatChannel(chat);
        const known = contact.channels[channel];
        return known && chat.participants?.items.some(user =>
          !user.isSelf && [user.username, user.id].some(s => s && handle(channel, s) === handle(channel, known)));
      });
    if (matches.length > 1) throw new Error(contact.slug + ": multiple Beeper chats; set beeper_chat_id");
    const chat = matches[0];
    const chatID = chat?.id ?? explicit;
    if (!chatID) continue;
    if (assigned.has(chatID)) throw new Error(contact.slug + ": Beeper chat also matches " + assigned.get(chatID));
    assigned.set(chatID, contact.slug);
    const channel = chat ? chatChannel(chat) : "beeper";
    const messages = await pages<BeeperMessage>("/v1/chats/" + encodeURIComponent(chatID) + "/messages");
    const entries = messages.filter(m => !m.isDeleted && !m.isHidden).map((m): Entry => ({
      id: m.id, at: m.timestamp, channel,
      direction: m.isSender ? "outbound" : "inbound",
      text: m.text || (m.attachments?.length ? "[attachment]" : "[no text]"),
    }));
    imports.push({ contact, entries, chatID });
  }
  return imports;
}

type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = {
  messageId?: string; id?: string; messageTimestamp?: string; internalDate?: string | number; labelIds?: string[];
  sender?: string; to?: string; subject?: string; messageText?: string; preview?: { body?: string }; snippet?: string;
  payload?: GmailPart & { headers?: { name: string; value: string }[] };
};

async function gmail(query: string): Promise<GmailMessage[]> {
  const messages: GmailMessage[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;
  do {
    const args = ["composio", "execute", "GMAIL_FETCH_EMAILS", "-d", JSON.stringify({
      query, max_results: 25, verbose: true, include_payload: true, page_token: pageToken,
    })];
    if (process.env.OUTREACH_GMAIL_ACCOUNT) args.push("--account", process.env.OUTREACH_GMAIL_ACCOUNT);
    const child = Bun.spawn(args, { stdin: "ignore", stdout: "pipe", stderr: "ignore", timeout: 60000 });
    const [output, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
    if (code !== 0) throw new Error("Composio Gmail query failed (exit " + code + "); check login and linked account");
    const result = JSON.parse(output);
    const data = result.data ?? result;
    if (result.successful === false || result.error || data.error) throw new Error("Composio Gmail query failed; check linked account");
    if (!Array.isArray(data.messages)) throw new Error("unexpected Composio Gmail response (expected messages)");
    messages.push(...data.messages);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    if (seen.has(pageToken)) throw new Error("repeated Gmail pagination token");
    seen.add(pageToken);
  } while (pageToken);
  return messages;
}

function plainText(part: GmailPart | undefined): string {
  if (part?.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  return part?.parts?.map(plainText).filter(Boolean).join("\n") ?? "";
}

function header(m: GmailMessage, key: string): string {
  const field = key === "from" ? m.sender : key === "to" ? m.to : key === "subject" ? m.subject : undefined;
  return m.payload?.headers?.find(h => h.name.toLowerCase() === key)?.value ?? field ?? "";
}

function addresses(value: string): string[] {
  return (value.toLowerCase().match(/[\w.!#$%&'*+/=?^{}\x60|~-]+@[\w.-]+/g) ?? []);
}

function gmailText(m: GmailMessage): string {
  return plainText(m.payload) || m.messageText || m.preview?.body || m.snippet || "";
}

function gmailEntry(m: GmailMessage, channel: string, direction: Entry["direction"], text: string): Entry {
  const id = m.messageId ?? m.id;
  if (!id) throw new Error("Gmail message has no ID");
  const at = new Date(m.internalDate === undefined ? Date.parse(m.messageTimestamp ?? "") : Number(m.internalDate)).toISOString();
  return { id: "gmail:" + id, at, channel, direction, text: text || "[no text]" };
}

export async function fromGmail(contacts: Contact[]): Promise<Import[]> {
  const imports: Import[] = [];
  for (const contact of contacts) {
    const entries: Entry[] = [];
    const email = contact.channels.email?.toLowerCase();
    if (email) {
      if (!/^[^\s"{}<>@]+@[a-z0-9.-]+$/.test(email)) throw new Error(contact.slug + ": invalid channels.email address");
      for (const m of await gmail('{from:"' + email + '" to:"' + email + '" cc:"' + email + '" bcc:"' + email + '"}')) {
        const sender = addresses(header(m, "from")).includes(email);
        const recipient = ["to", "cc", "bcc"].some(key => addresses(header(m, key)).includes(email));
        const sent = m.labelIds?.includes("SENT");
        if (m.labelIds?.includes("DRAFT") || !(sent ? recipient : sender)) continue;
        entries.push(gmailEntry(m, "email", sent ? "outbound" : "inbound", gmailText(m) || header(m, "subject")));
      }
    }
    const reddit = contact.channels.reddit && handle("reddit", contact.channels.reddit);
    if (reddit) {
      if (!/^[a-z0-9_-]+$/.test(reddit)) throw new Error(contact.slug + ": invalid channels.reddit username");
      const sender = new RegExp("(?:^|[^\\w-])(?:/?u/)?" + reddit + " (?:sent|messaged|invited)\\b", "i");
      const profile = new RegExp("(?:^|[^\\w/-])/?u/" + reddit + "(?:$|[^\\w-])", "i");
      const query = '{from:redditmail.com from:reddit.com} {subject:message subject:chat} "' + reddit + '"';
      for (const m of await gmail(query)) {
        const subject = header(m, "subject");
        const body = gmailText(m);
        if (!addresses(header(m, "from")).some(addr => /@(?:[\w-]+\.)?reddit(?:mail)?\.com$/.test(addr))) continue;
        if (!/\b(?:message|chat)\b/i.test(subject) || !(sender.test(subject) || sender.test(body) || profile.test(subject + "\n" + body))) continue;
        entries.push(gmailEntry(m, "reddit", "inbound", body || subject));
      }
    }
    if (entries.length) imports.push({ contact, entries });
  }
  return imports;
}
