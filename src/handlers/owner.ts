import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const OWNER_ID = Number(process.env.OWNER_ID ?? "0");

function isOwner(ctx: Ctx): boolean {
  if (OWNER_ID && ctx.from?.id === OWNER_ID) return true;
  return false;
}

const composer = new Composer<Ctx>();

composer.command("owner", async (ctx) => {
  if (!isOwner(ctx)) {
    await ctx.reply("This command is only available to the bot owner.");
    return;
  }
  const alertCount = (ctx.session.alerts ?? []).length;
  await ctx.reply(
    `📊 Bot statistics\n\n` +
      `Your alerts: ${alertCount}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery("owner:stats", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isOwner(ctx)) {
    await ctx.reply("This command is only available to the bot owner.");
    return;
  }
  const alertCount = (ctx.session.alerts ?? []).length;
  await ctx.editMessageText(
    `📊 Bot statistics\n\n` +
      `Your alerts: ${alertCount}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

export default composer;
