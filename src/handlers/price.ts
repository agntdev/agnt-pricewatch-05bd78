import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "💰 Prices", data: "price:show", order: 25 });

const COMINGECKO_BASE = "https://api.coingecko.com/api/v3";

async function fetchPrices(
  coinIds: string[],
): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  const ids = coinIds.join(",");
  const url = `${COMINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
  return (await res.json()) as Record<string, { usd: number; usd_24h_change: number }>;
}

function formatPrice(price: number): string {
  if (price >= 1)
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(6)}`;
}

function formatChange(change: number | undefined): string {
  if (change === undefined || change === null) return "";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

function ensureWatchlist(ctx: Ctx) {
  if (!ctx.session.watchlist) ctx.session.watchlist = [];
}

function emptyState() {
  return {
    text: "Your watchlist is empty. Add some coins first.",
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add ticker", "add:start")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  };
}

const composer = new Composer<Ctx>();

composer.command("price", async (ctx) => {
  ensureWatchlist(ctx);
  if (ctx.session.watchlist!.length === 0) {
    await ctx.reply(emptyState().text, { reply_markup: emptyState().reply_markup });
    return;
  }
  const coinIds = ctx.session.watchlist!.map((w) => w.coinId);
  try {
    const prices = await fetchPrices(coinIds);
    const lines = ctx.session.watchlist!.map((w) => {
      const p = prices[w.coinId];
      if (!p) return `${w.ticker} — price unavailable`;
      const change = formatChange(p.usd_24h_change);
      return `${w.ticker} — ${formatPrice(p.usd)}${change ? ` (${change})` : ""}`;
    });
    await ctx.reply(`Current prices:\n\n${lines.join("\n")}`, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Refresh", "price:show")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  } catch {
    await ctx.reply("Couldn't reach the price service. Try again in a moment.", {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Retry", "price:show")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  }
});

composer.callbackQuery("price:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  ensureWatchlist(ctx);
  if (ctx.session.watchlist!.length === 0) {
    await ctx.editMessageText(emptyState().text, { reply_markup: emptyState().reply_markup });
    return;
  }
  const coinIds = ctx.session.watchlist!.map((w) => w.coinId);
  try {
    const prices = await fetchPrices(coinIds);
    const lines = ctx.session.watchlist!.map((w) => {
      const p = prices[w.coinId];
      if (!p) return `${w.ticker} — price unavailable`;
      const change = formatChange(p.usd_24h_change);
      return `${w.ticker} — ${formatPrice(p.usd)}${change ? ` (${change})` : ""}`;
    });
    await ctx.editMessageText(`Current prices:\n\n${lines.join("\n")}`, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔄 Refresh", "price:show")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  } catch {
    await ctx.editMessageText(
      "Couldn't reach the price service. Try again in a moment.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("🔄 Retry", "price:show")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
  }
});

export default composer;
