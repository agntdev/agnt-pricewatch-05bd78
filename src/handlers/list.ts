import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "📋 Watchlist", data: "list:show", order: 20 });

const composer = new Composer<Ctx>();

function ensureWatchlist(ctx: Ctx) {
  if (!ctx.session.watchlist) ctx.session.watchlist = [];
}

function renderWatchlistEmpty() {
  return {
    text: "Your watchlist is empty. Tap ➕ Add to add your first coin.",
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add ticker", "add:start")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  };
}

function renderWatchlist(watchlist: NonNullable<Ctx["session"]["watchlist"]>) {
  const lines = watchlist.map(
    (w, i) => `${i + 1}. ${w.ticker} — ${w.displayName}`,
  );
  const buttons = watchlist.map((w) => [
    inlineButton(`🗑 Remove ${w.ticker}`, `list:rm:${w.ticker}`),
  ]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  return {
    text: `Your watchlist (${watchlist.length} coin${watchlist.length !== 1 ? "s" : ""}):\n\n${lines.join("\n")}`,
    reply_markup: inlineKeyboard(buttons),
  };
}

composer.command("list", async (ctx) => {
  ensureWatchlist(ctx);
  if (ctx.session.watchlist!.length === 0) {
    await ctx.reply(renderWatchlistEmpty().text, {
      reply_markup: renderWatchlistEmpty().reply_markup,
    });
    return;
  }
  const r = renderWatchlist(ctx.session.watchlist!);
  await ctx.reply(r.text, { reply_markup: r.reply_markup });
});

composer.callbackQuery("list:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  ensureWatchlist(ctx);
  if (ctx.session.watchlist!.length === 0) {
    await ctx.editMessageText(renderWatchlistEmpty().text, {
      reply_markup: renderWatchlistEmpty().reply_markup,
    });
    return;
  }
  const r = renderWatchlist(ctx.session.watchlist!);
  await ctx.editMessageText(r.text, { reply_markup: r.reply_markup });
});

composer.callbackQuery(/^list:rm:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match![1];
  ensureWatchlist(ctx);
  const idx = ctx.session.watchlist!.findIndex((w) => w.ticker === ticker);
  if (idx < 0) {
    await ctx.reply(`${ticker} isn't on your watchlist.`);
    return;
  }
  const removed = ctx.session.watchlist!.splice(idx, 1)[0];
  ctx.session.alerts = (ctx.session.alerts ?? []).filter((a) => a.ticker !== ticker);
  if (ctx.session.watchlist!.length === 0) {
    await ctx.editMessageText(
      `Removed ${removed.ticker}. Your watchlist is now empty.`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("➕ Add ticker", "add:start")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
  } else {
    const r = renderWatchlist(ctx.session.watchlist!);
    await ctx.editMessageText(r.text, { reply_markup: r.reply_markup });
  }
});

export default composer;
