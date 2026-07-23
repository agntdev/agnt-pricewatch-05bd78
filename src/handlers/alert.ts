import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "🔔 Alerts", data: "alert:menu", order: 30 });

function ensureWatchlist(ctx: Ctx) {
  if (!ctx.session.watchlist) ctx.session.watchlist = [];
}

function ensureAlerts(ctx: Ctx) {
  if (!ctx.session.alerts) ctx.session.alerts = [];
}

function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("alert:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  ensureWatchlist(ctx);
  if (ctx.session.watchlist!.length === 0) {
    await ctx.editMessageText(
      "Add coins to your watchlist first, then set up price alerts.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Add ticker", "add:start")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
  const buttons = ctx.session.watchlist!.map((w) => [
    inlineButton(`🔔 ${w.ticker}`, `alert:pick:${w.ticker}`),
  ]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.editMessageText("Pick a coin to set an alert for:", {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^alert:pick:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match![1];
  ctx.session.alertTicker = ticker;
  ensureWatchlist(ctx);
  const coin = ctx.session.watchlist!.find((w) => w.ticker === ticker);
  if (!coin) {
    await ctx.editMessageText(`${ticker} isn't on your watchlist.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.alertCoinId = coin.coinId;
  ctx.session.step = "awaiting_alert_type";
  await ctx.editMessageText(
    `What kind of alert for ${ticker}?`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("📈 Price above", "alert:type:above")],
        [inlineButton("📉 Price below", "alert:type:below")],
        [inlineButton("📊 % Change", "alert:type:percent_change")],
        [inlineButton("⬅️ Back", "alert:menu")],
      ]),
    },
  );
});

composer.callbackQuery(/^alert:type:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const alertType = ctx.match![1];
  ctx.session.alertType = alertType;
  ctx.session.step = "awaiting_alert_value";
  const label =
    alertType === "above"
      ? "price above"
      : alertType === "below"
        ? "price below"
        : "percent change of";
  await ctx.editMessageText(
    `Enter the ${label} threshold (e.g. ${alertType === "percent_change" ? "5" : "50000"}):`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back", `alert:pick:${ctx.session.alertTicker}`)],
      ]),
    },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_alert_value") return next();
  const raw = ctx.message.text.trim();
  const value = parseFloat(raw);
  if (isNaN(value) || value <= 0) {
    await ctx.reply("Please enter a valid positive number.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.alertValue = value;
  ctx.session.step = undefined;
  const ticker = ctx.session.alertTicker ?? "???";
  const alertType = ctx.session.alertType ?? "above";
  const typeLabel =
    alertType === "above"
      ? `above $${value.toLocaleString()}`
      : alertType === "below"
        ? `below $${value.toLocaleString()}`
        : `${value}% change`;
  const alertId = generateAlertId();
  await ctx.reply(
    `Confirm alert for ${ticker}:\n\nPrice ${typeLabel}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Create alert", `alert:confirm:${alertId}`)],
        [inlineButton("❌ Cancel", "alert:cancel")],
      ]),
    },
  );
});

composer.callbackQuery(/^alert:confirm:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const alertId = ctx.match![1];
  const ticker = ctx.session.alertTicker;
  const coinId = ctx.session.alertCoinId;
  const alertType = ctx.session.alertType;
  const value = ctx.session.alertValue;
  if (!ticker || !coinId || !alertType || value === undefined) {
    await ctx.editMessageText("Flow expired. Tap 🔔 Alerts to start again.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  ensureAlerts(ctx);
  ctx.session.alerts!.push({
    id: alertId,
    ticker,
    coinId,
    type: alertType as "above" | "below" | "percent_change",
    value,
    enabled: true,
    lastFired: null,
  });
  const typeLabel =
    alertType === "above"
      ? `above $${value.toLocaleString()}`
      : alertType === "below"
        ? `below $${value.toLocaleString()}`
        : `${value}% change`;
  ctx.session.alertTicker = undefined;
  ctx.session.alertCoinId = undefined;
  ctx.session.alertType = undefined;
  ctx.session.alertValue = undefined;
  await ctx.editMessageText(
    `✅ Alert created: ${ticker} ${typeLabel}. You'll be notified when the condition is met.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🔔 Add another alert", "alert:menu")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery("alert:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  ctx.session.alertTicker = undefined;
  ctx.session.alertCoinId = undefined;
  ctx.session.alertType = undefined;
  ctx.session.alertValue = undefined;
  await ctx.editMessageText("Alert cancelled.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
