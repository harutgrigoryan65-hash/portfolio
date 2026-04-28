import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadLocalEnv() {
    const localEnvPath = join(process.cwd(), ".env.local");

    if (!existsSync(localEnvPath)) return;

    const lines = readFileSync(localEnvPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;

        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");

        if (key && !process.env[key]) {
            process.env[key] = value;
        }
    }
}

function setCorsHeaders(req, res) {
    const configuredOrigin = process.env.SITE_ORIGIN;
    const requestOrigin = req.headers.origin;
    const origin = configuredOrigin || requestOrigin || "*";

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function escapeTelegramHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function getTelegramConfig() {
    return {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_ADMIN_ID
    };
}

function validateSessionId(sessionId) {
    return typeof sessionId === "string" && /^[a-z0-9]{10,40}$/i.test(sessionId);
}

async function callTelegram(method, payload) {
    const { token } = getTelegramConfig();
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
        throw new Error(data.description || "Telegram API request failed");
    }

    return data.result;
}

async function sendTelegramMessage(text) {
    const { chatId } = getTelegramConfig();

    return callTelegram("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
    });
}

function buildSessionKey(sessionId) {
    return `site_${sessionId}`;
}

function isReplyForSession(message, sessionKey) {
    const reply = message?.reply_to_message;
    const replyText = `${reply?.text || ""}\n${reply?.caption || ""}`;
    return replyText.includes(sessionKey);
}

function extractOwnerReplies(updates, sessionId, lastUpdateId) {
    const { chatId } = getTelegramConfig();
    const sessionKey = buildSessionKey(sessionId);
    const replies = [];
    let nextUpdateId = Number.isFinite(lastUpdateId) ? lastUpdateId : 0;

    for (const update of updates) {
        if (typeof update.update_id === "number" && update.update_id > nextUpdateId) {
            nextUpdateId = update.update_id;
        }

        if (typeof update.update_id !== "number" || update.update_id <= lastUpdateId) continue;

        const message = update.message;
        const content = typeof message?.text === "string" ? message.text.trim() : "";

        if (!content || String(message?.chat?.id) !== String(chatId)) continue;
        if (!isReplyForSession(message, sessionKey)) continue;

        replies.push({
            id: `tg_${update.update_id}`,
            content,
            createdAt: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString()
        });
    }

    return { replies, nextUpdateId };
}

export default async function handler(req, res) {
    loadLocalEnv();
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { token, chatId } = getTelegramConfig();

    if (!token || !chatId) {
        return res.status(500).json({ error: "Telegram is not configured" });
    }

    const action = typeof req.body?.action === "string" ? req.body.action : "";
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";

    if (!validateSessionId(sessionId)) {
        return res.status(400).json({ error: "Invalid session" });
    }

    const sessionKey = buildSessionKey(sessionId);
    const origin = req.headers.origin || req.headers.referer || "direct request";

    try {
        if (action === "connect") {
            const context = typeof req.body?.context === "string" ? req.body.context.trim().slice(0, 900) : "";
            const text = [
                "<b>Website visitor wants to talk to you</b>",
                "",
                `<b>Session:</b> <code>${sessionKey}</code>`,
                `<b>From:</b> ${escapeTelegramHtml(origin)}`,
                context ? `<b>Context:</b>\n${escapeTelegramHtml(context)}` : "",
                "",
                "Reply to this Telegram message. Your reply will appear in the website chat while the visitor keeps the page open."
            ].filter(Boolean).join("\n");

            await sendTelegramMessage(text);
            return res.status(200).json({ ok: true });
        }

        if (action === "message") {
            const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";

            if (!content || content.length > 1200) {
                return res.status(400).json({ error: "Invalid message" });
            }

            const text = [
                "<b>Visitor message</b>",
                "",
                `<b>Session:</b> <code>${sessionKey}</code>`,
                `<b>Message:</b>\n${escapeTelegramHtml(content)}`,
                "",
                "Reply to this Telegram message to answer in the website chat."
            ].join("\n");

            await sendTelegramMessage(text);
            return res.status(200).json({ ok: true });
        }

        if (action === "leave") {
            const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
            const text = [
                "<b>Visitor left direct chat</b>",
                "",
                `<b>Session:</b> <code>${sessionKey}</code>`,
                reason ? `<b>Reason:</b>\n${escapeTelegramHtml(reason)}` : "",
                "",
                "No need to wait for this visitor unless they start a new direct chat."
            ].filter(Boolean).join("\n");

            await sendTelegramMessage(text);
            return res.status(200).json({ ok: true });
        }

        if (action === "poll") {
            const lastUpdateId = Number.isFinite(Number(req.body?.lastUpdateId))
                ? Number(req.body.lastUpdateId)
                : 0;
            const updates = await callTelegram("getUpdates", {
                limit: 100,
                timeout: 0,
                allowed_updates: ["message"]
            });
            const { replies, nextUpdateId } = extractOwnerReplies(updates, sessionId, lastUpdateId);

            return res.status(200).json({
                ok: true,
                messages: replies,
                nextUpdateId
            });
        }

        return res.status(400).json({ error: "Unknown action" });
    } catch (error) {
        console.error("Human chat error:", error);
        return res.status(500).json({ error: "Human chat request failed" });
    }
}
