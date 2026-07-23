import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "🪙 Common coins", data: "add_common", order: 15 });

const POPULAR_COINS = [
  { ticker: "BTC", coinId: "bitcoin", name: "Bitcoin" },
  { ticker: "ETH", coinId: "ethereum", name: "Ethereum" },
  { ticker: "SOL", coinId: "solana", name: "Solana" },
  { ticker: "ADA", coinId: "cardano", name: "Cardano" },
  { ticker: "DOGE", coinId: "dogecoin", name: "Dogecoin" },
  { ticker: "XRP", coinId: "ripple", name: "XRP" },
  { ticker: "DOT", coinId: "polkadot", name: "Polkadot" },
  { ticker: "LINK", coinId: "chainlink", name: "Chainlink" },
  { ticker: "AVAX", coinId: "avalanche-2", name: "Avalanche" },
  { ticker: "UNI", coinId: "uniswap", name: "Uniswap" },
];

const composer = new Composer<Ctx>();

function ensureWatchlist(ctx: Ctx) {
  if (!ctx.session.watchlist) ctx.session.watchlist = [];
}

composer.callbackQuery("add_common", async (ctx) => {
  await ctx.answerCallbackQuery();
  ensureWatchlist(ctx);
  const existingTickers = new Set(ctx.session.watchlist!.map((w) => w.ticker));
  const buttons = POPULAR_COINS.map((coin) => {
    const added = existingTickers.has(coin.ticker);
    return [
      inlineButton(
        added ? `✅ ${coin.ticker}` : `${coin.ticker} — ${coin.name}`,
        added ? `noop` : `addc:${coin.ticker}`,
      ),
    ];
  });
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.editMessageText(
    existingTickers.size > 0
      ? "Quick-add popular coins. ✅ = already on your watchlist."
      : "Quick-add popular coins to your watchlist:",
    { reply_markup: inlineKeyboard(buttons) },
  );
});

composer.callbackQuery(/^addc:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match![1];
  const coin = POPULAR_COINS.find((c) => c.ticker === ticker);
  if (!coin) {
    await ctx.reply("Unknown coin. Try again.");
    return;
  }
  ensureWatchlist(ctx);
  const exists = ctx.session.watchlist!.some((w) => w.ticker === ticker);
  if (exists) {
    await ctx.reply(`${ticker} is already on your watchlist.`);
    return;
  }
  ctx.session.watchlist!.push({
    ticker: coin.ticker,
    displayName: coin.name,
    coinId: coin.coinId,
    lastPrice: null,
    lastChecked: 0,
  });
  const count = ctx.session.watchlist!.length;
  await ctx.editMessageText(
    `✅ Added ${coin.ticker} (${coin.name}). You're tracking ${count} coin${count !== 1 ? "s" : ""} now.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add more", "add_common")],
        [inlineButton("📋 View watchlist", "list:show")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery("noop", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Already on your watchlist" });
});

export default composer;
