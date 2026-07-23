import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "➕ Add ticker", data: "add:start", order: 10 });

const COMMON_COINS: Record<string, { coinId: string; name: string }> = {
  BTC: { coinId: "bitcoin", name: "Bitcoin" },
  ETH: { coinId: "ethereum", name: "Ethereum" },
  SOL: { coinId: "solana", name: "Solana" },
  ADA: { coinId: "cardano", name: "Cardano" },
  DOGE: { coinId: "dogecoin", name: "Dogecoin" },
  XRP: { coinId: "ripple", name: "XRP" },
  DOT: { coinId: "polkadot", name: "Polkadot" },
  LINK: { coinId: "chainlink", name: "Chainlink" },
  AVAX: { coinId: "avalanche-2", name: "Avalanche" },
  UNI: { coinId: "uniswap", name: "Uniswap" },
};

const composer = new Composer<Ctx>();

function ensureWatchlist(ctx: Ctx) {
  if (!ctx.session.watchlist) ctx.session.watchlist = [];
}

function buildAddKeyboard() {
  return inlineKeyboard([
    [inlineButton("❓ Enter ticker manually", "add:manual")],
    [inlineButton("🪙 Common coins", "add:common")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
}

composer.command("add", async (ctx) => {
  await ctx.reply("How would you like to add a ticker?", {
    reply_markup: buildAddKeyboard(),
  });
});

composer.callbackQuery("add:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("How would you like to add a ticker?", {
    reply_markup: buildAddKeyboard(),
  });
});

composer.callbackQuery("add:manual", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_ticker";
  await ctx.editMessageText(
    "Type the ticker symbol (e.g. BTC, ETH, SOL).",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back", "add:start")],
      ]),
    },
  );
});

composer.callbackQuery("add:common", async (ctx) => {
  await ctx.answerCallbackQuery();
  ensureWatchlist(ctx);
  const existingTickers = new Set(ctx.session.watchlist!.map((w) => w.ticker));
  const buttons = Object.entries(COMMON_COINS).map(([ticker, info]) => {
    const added = existingTickers.has(ticker);
    return [
      inlineButton(
        added ? `✅ ${ticker}` : `${ticker} — ${info.name}`,
        added ? `noop` : `addc:${ticker}`,
      ),
    ];
  });
  buttons.push([inlineButton("⬅️ Back", "add:start")]);
  await ctx.editMessageText("Pick a coin to add:", {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^add:pick:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match![1];
  const info = COMMON_COINS[ticker];
  if (!info) {
    await ctx.editMessageText("Unknown ticker. Try again.");
    return;
  }
  ensureWatchlist(ctx);
  const exists = ctx.session.watchlist!.some(
    (w) => w.ticker === ticker || w.coinId === info.coinId,
  );
  if (exists) {
    await ctx.editMessageText(`${ticker} is already on your watchlist.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.watchlist!.push({
    ticker,
    displayName: info.name,
    coinId: info.coinId,
    lastPrice: null,
    lastChecked: 0,
  });
  await ctx.editMessageText(`✅ Added ${ticker} (${info.name}) to your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add another", "add:start")],
      [inlineButton("📋 View watchlist", "list:show")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_ticker") return next();
  const raw = ctx.message.text.trim().toUpperCase();
  ctx.session.step = undefined;
  const info = COMMON_COINS[raw];
  if (!info) {
    await ctx.reply(
      `Couldn't find "${raw}". Try a known ticker like BTC, ETH, or SOL.`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }
  ensureWatchlist(ctx);
  const exists = ctx.session.watchlist!.some(
    (w) => w.ticker === raw || w.coinId === info.coinId,
  );
  if (exists) {
    await ctx.reply(`${raw} is already on your watchlist.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.watchlist!.push({
    ticker: raw,
    displayName: info.name,
    coinId: info.coinId,
    lastPrice: null,
    lastChecked: 0,
  });
  await ctx.reply(`✅ Added ${raw} (${info.name}) to your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add another", "add:start")],
      [inlineButton("📋 View watchlist", "list:show")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
