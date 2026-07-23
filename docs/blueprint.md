# Crypto Watchlist Alerts — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot for tracking crypto prices with customizable threshold/percent alerts, on-demand price checks, and optional daily summaries. Users manage personal watchlists while the owner tracks aggregate usage metrics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual crypto investors
- Telegram bot owners

## Success criteria

- User completes setup with timezone/quiet hours
- User creates at least one active alert rule
- System delivers 99%+ of scheduled alerts within 5-minute window

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Initialize bot and show setup wizard
- **/add** (command, actor: user, command: /add) — Add new ticker to watchlist
- **/list** (command, actor: user, command: /list) — Show and manage current watchlist items
- **/price** (command, actor: user, command: /price) — Request current prices for watchlist or specific ticker
- **Common Coins** (button, actor: user, callback: add_common) — Quick-add popular tickers (BTC, ETH, etc)
- **/owner** (command, actor: owner, command: /owner) — Display aggregate usage statistics

## Flows

### alert_creation
_Trigger:_ button_press or /alert command

1. Select ticker from watchlist
2. Choose alert type (threshold/percent)
3. Set parameters via conversation
4. Confirm with inline buttons

_Data touched:_ Alert, WatchlistItem

### daily_summary
_Trigger:_ scheduled_event

1. Check user's local time matches configured summary time
2. Aggregate price changes since previous day
3. Format and deliver summary message

_Data touched:_ UserProfile, WatchlistItem

### alert_delivery
_Trigger:_ price_threshold_reached

1. Check quiet hours/cooldown periods
2. Queue alert message
3. Send via Telegram with timestamp

_Data touched:_ Alert, UserProfile

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **UserProfile** _(retention: persistent)_ — User preferences and settings
  - fields: telegram_id, timezone, quiet_hours, summary_time, alert_cooldown
- **WatchlistItem** _(retention: persistent)_ — Tracked cryptocurrency ticker
  - fields: ticker, display_name, last_price, alert_rules
- **Alert** _(retention: persistent)_ — Active alert configuration
  - fields: type, parameters, enabled, last_fired
- **AggregateStats** _(retention: persistent)_ — Owner analytics data
  - fields: user_count, alert_fire_counts

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- /owner command to view metrics
- Access to alert-fire statistics
- Ability to review system health metrics

## Notifications

- Price alerts during active hours
- Daily summary at configured time
- Owner dashboard updates
- Error notifications for failed price checks

## Permissions & privacy

- Private user data stored securely
- Quiet hours respect user preferences
- No third-party data sharing
- Alert history retained for cooldown tracking

## Edge cases

- Unknown/invalid ticker handling
- Price feed failures with retries
- Concurrent alert triggers
- Timezone daylight saving transitions
- Multiple alert types on same ticker

## Required tests

- End-to-end alert creation workflow
- Daily summary delivery validation
- Quiet hours alert suppression test
- Cooldown period enforcement
- Owner metrics accuracy check

## Assumptions

- Price feed has 99.9% availability
- Users have stable Telegram connections
- Timezone settings are accurate
- Alert cooldowns prevent spamming
