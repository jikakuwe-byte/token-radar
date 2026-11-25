// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and may add
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures. The anchor is not a fixed multiple:
// it is what the market already pays for a dollar of TVL in live protocols like this one.
//
//   peerMult   = median(mcap_usd / tvl_usd) over the snapshot's live-token protocols in the same
//                category (at least PEER_MIN_SAMPLE of them), else the median over every live
//                protocol, clamped to [PEER_FLOOR, PEER_CAP]
//   growth     = clamp(change_7d, -50, 100) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.65 + min(age_days, 1460) / 1460 x 0.45   (age_days unknown: 365)
//   breadth    = 1 + min(chains - 1, 4) x 0.04   (a protocol live on more chains has more users
//                a token can be dropped to)
//   implied    = max(1, round(tvl_usd x peerMult x growthMult x maturity x breadth))
//
// Every input is read from the snapshot at run time: the peer multiples move with the market the
// snapshot records, never with a hand-set constant. No protocol name is ever special-cased: the
// same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  /** How much of the (clamped) seven-day growth feeds the growth multiplier. */
  growth_weight: number;
  /** The growth clamp, in per cent: a crash week counts at most this much against a row. */
  growth_floor: number;
  /** The growth clamp's top: a parabolic week counts at most this much for a row. */
  growth_cap: number;
  /** The maturity multiplier of a protocol listed today. */
  maturity_floor: number;
  /** How much maturity a full `maturity_days` of age adds on top of the floor. */
  maturity_range: number;
  /** The age, in days, at which the maturity multiplier stops growing. */
  maturity_days: number;
  /** The age the model assumes when the snapshot records no listing date. */
  unknown_age_days: number;
  /** The lowest peer multiple a row may be anchored to, however cheap its peers trade. */
  peer_floor: number;
  /** The highest peer multiple a row may be anchored to, however rich its peers trade. */
  peer_cap: number;
  /** How many live protocols a category needs before its own median anchors its rows. */
  peer_min_sample: number;
  /** The breadth multiplier's gain for each extra chain, up to the cap below. */
  breadth_step: number;
  /** How many extra chains the breadth multiplier rewards. */
  breadth_max_extra_chains: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.55,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.65,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 365,
  peer_floor: 0.08,
  peer_cap: 2.5,
  peer_min_sample: 4,
  breadth_step: 0.04,
  breadth_max_extra_chains: 4,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 220;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/**
 * One row of board.json: the ranked board's row. The first eleven fields are the snapshot's own
 * record, carried through unchanged; the rest are the model's work — the age it derived, the value
 * it implied, the exact multipliers that produced that value (so anyone can recompute the row from
 * the snapshot figures alone), and the farm plan as finished strings.
 */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    /** The peer anchor this row was priced from, at full precision (see buildBoard). */
    peer_multiple: number;
    /** Where that anchor came from: the row's category median, or the global one. */
    peer_basis: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/**
 * The dashboard's compact view of one row, written to data.js. It carries everything the page
 * renders and everything the page needs to recompute the row's implied value and regenerate its
 * farm plan — the peer multiple at full precision included — plus one flag the board itself does
 * not need: whether the row came in through the watchlist or up through the early radar.
 */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  peer_multiple: number;
  peer_basis: string;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_peer_multiple: number;
  peer_sample_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The middle value of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** What the snapshot's live-token protocols say a dollar of TVL is worth, per category and overall. */
export interface PeerMultiples {
  byCategory: Map<string, number>;
  global: number;
  sampleSize: number;
}

/**
 * The peer multiples, read from the snapshot itself: for every live protocol (one that records a
 * market cap), the ratio mcap / TVL; the median of a category's ratios when the category has at
 * least `peer_min_sample` live protocols, and the median of all of them as the fallback. Ratios
 * outside [0.01, 20] are dropped before the median: a stale or broken record must not anchor a
 * whole category. The multiple a row finally uses is clamped to [peer_floor, peer_cap].
 */
export function peerMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): PeerMultiples {
  const ratios: number[] = [];
  const byCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio < 0.01 || ratio > 20) continue;
    ratios.push(ratio);
    const key = p.category ?? 'Other';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  const medians = new Map<string, number>();
  for (const [category, list] of byCategory) {
    if (list.length >= model.peer_min_sample) medians.set(category, median(list));
  }
  return { byCategory: medians, global: ratios.length > 0 ? median(ratios) : model.peer_floor, sampleSize: ratios.length };
}

/** The peer multiple one protocol is anchored to, and where it came from. */
export function peerMultipleFor(protocol: SnapshotProtocol, peers: PeerMultiples, model: ModelConstants = MODEL): { multiple: number; basis: string } {
  const category = protocol.category ?? 'Other';
  const own = peers.byCategory.get(category);
  const raw = own ?? peers.global;
  const multiple = Math.min(model.peer_cap, Math.max(model.peer_floor, raw));
  return { multiple, basis: own !== undefined ? `median of ${category} live peers` : 'median of all live peers' };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants, peers: PeerMultiples): { implied: number; peerMult: number; peerBasis: string; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra_chains);
  const breadthMult = 1 + extraChains * model.breadth_step;
  const { multiple: peerMult, basis: peerBasis } = peerMultipleFor(protocol, peers, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * peerMult * growthMult * maturityMult * breadthMult));
  return { implied, peerMult, peerBasis, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/**
 * The protocols the board ranks, before any scoring: the whole watchlist first (the floor, never a
 * ceiling — every slug, even one the snapshot no longer carries; it cannot, but the board's coverage
 * is the gate's row and is never gambled on a missing record), then the early radar: rankable
 * pre-token protocols below the floor, by TVL, capped at EARLY_ROWS. An early row never replaces a
 * watchlist row: a chosen protocol stays chosen.
 */
function chooseProtocols(snapshot: Snapshot): Map<string, SnapshotProtocol> {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);
  return chosen;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const chosen = chooseProtocols(snapshot);
  const peers = peerMultiples(snapshot, model);
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, peers);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      // Full precision, never rounded: the dashboard recomputes the implied value from this
      // multiple and checks it against the board's number, so a rounded copy would disagree.
      peer_multiple: s.peerMult,
      peer_basis: s.peerBasis,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/**
 * The farm capital ladder: the smallest position that still looks like real usage at each size of
 * protocol. Bigger protocols clear activity thresholds with bigger positions; the smallest tier is
 * the floor every farm on the board can afford.
 */
const CAPITAL_LADDER: { min_tvl_usd: number; capital: number }[] = [
  { min_tvl_usd: 5_000_000_000, capital: 250 },
  { min_tvl_usd: 1_000_000_000, capital: 150 },
  { min_tvl_usd: 100_000_000, capital: 100 },
  { min_tvl_usd: 0, capital: 50 },
];

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  for (const rung of CAPITAL_LADDER) if (p.tvl_usd >= rung.min_tvl_usd) return rung.capital;
  return 50;
}

/**
 * The hold ladder, from the protocol's age: a young protocol's snapshots are sparse, so its farm
 * waits longer to be counted twice; an old protocol is in every snapshot already and needs only
 * the standard month. An unknown age takes the standard month too.
 */
const HOLD_LADDER: { max_age_days: number; hold_days: number }[] = [
  { max_age_days: 180, hold_days: 60 },
  { max_age_days: 365, hold_days: 45 },
  { max_age_days: Number.POSITIVE_INFINITY, hold_days: 30 },
];

/** How long to hold, from the protocol's age. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  for (const rung of HOLD_LADDER) if (age < rung.max_age_days) return rung.hold_days;
  return 30;
}

/**
 * The category rules behind the farm plan's main action: the first rule whose words appear in the
 * protocol's category (lowercased) wins, and each rule writes the action in the words a farmer can
 * follow. A category no rule names falls through to the plain deposit at the end. The dashboard
 * carries the same table, so the plan it generates in the page is the plan board.json holds.
 */
const ACTION_RULES: { words: string[]; write: (name: string, capital: number, chain: string) => string }[] = [
  {
    words: ['lend', 'cdp', 'collateral'],
    write: (name, capital, chain) => `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`,
  },
  {
    words: ['dex', 'yield', 'leveraged farm'],
    write: (name, capital, chain) => `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`,
  },
  {
    words: ['bridge'],
    write: (name, capital, chain) => `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`,
  },
  {
    words: ['staking', 'restak'],
    write: (name, capital, chain) => `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`,
  },
  {
    words: ['perpetual', 'derivative'],
    write: (name, capital, chain) => `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`,
  },
  {
    words: ['prediction'],
    write: (name, capital) => `Fund $${capital} and place one market position on ${name}.`,
  },
  {
    words: ['curator', 'allocator'],
    write: (name, capital, chain) => `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`,
  },
  {
    words: ['stable'],
    write: (name, capital, chain) => `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`,
  },
  {
    words: ['rwa'],
    write: (name, capital, chain) => `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`,
  },
  {
    words: ['insurance'],
    write: (name, capital, chain) => `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`,
  },
];

/** The category's one action, from the first matching rule, or a plain deposit when none matches. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  for (const rule of ACTION_RULES) {
    if (rule.words.some((w) => c.includes(w))) return rule.write(p.name, capital, chain);
  }
  return `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
}

/** The weekly qualifying action, in the protocol's own category's terms. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Add or repay a small amount against the ${name} position each week, so the account shows borrowing activity, not just a deposit.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap a small amount through ${name} each week and rebalance the liquidity position if it drifts out of range.`;
  if (c.includes('bridge')) return `Bridge a small amount through ${name} each week, alternating direction, and use the funds on the far side.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim and restake the staking rewards on ${name} each week so the receipt balance keeps growing.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Open and close one small hedged trade on ${name} each week to build a real trading history.`;
  if (c.includes('prediction')) return `Place one small position on a new ${name} market each week and settle it when the market closes.`;
  return `Repeat the core action on ${name} each week: a deposit, a swap, a vote or a claim, in a similar size each time.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. A protocol live on several chains gets a second-chain step; a single-chain one gets a
 * depth step on its own chain instead.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const breadthStep: FarmStep = secondChain !== null
    ? {
        text: `${p.name} also runs on ${secondChain}: repeat the position there with $${Math.max(25, Math.round(capital / 2))} so the farm is not a single-chain snapshot.`,
        cost: `about $${Math.max(25, Math.round(capital / 2))} of extra capital plus bridge and gas fees of about $5`,
        time: '20 minutes',
      }
    : {
        text: `Deepen the ${chain} position once after two weeks: add 25% more capital if the first position settled without issues.`,
        cost: `about $${Math.round(capital / 4)} of extra capital and $2 of gas`,
        time: '10 minutes',
      };
  return [
    {
      text: `Set up one fresh wallet for ${p.name} alone, fund it only with what this farm needs, and keep its seed phrase offline on paper.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `Open ${p.name}'s own documentation, check the contract address it publishes there, and send a $10 test transaction before any real approval.`,
      cost: '$10 of test capital and about $1 of gas',
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    breadthStep,
    {
      text: weeklyActionFor(p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days, across more than one weekly snapshot, and look at the protocol's points or rewards page every week while you wait.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `If a token or points conversion is announced, claim only through the link ${p.name} itself publishes, then record the wallet, the dates and every transaction in a farm log so the position can be unwound cleanly.`,
      cost: 'no fee to check, and never pay to claim',
      time: '15 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    peer_multiple: row.model.peer_multiple,
    peer_basis: row.model.peer_basis,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const peers = peerMultiples(snapshot, model);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_peer_multiple: round4(Math.min(model.peer_cap, Math.max(model.peer_floor, peers.global))),
    peer_sample_size: peers.sampleSize,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
  };
  return { board, radar };
}

/** A string field read leniently: the string itself, or null for anything else. */
function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** A numeric field read leniently: a finite number, or null for anything else. */
function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** One protocol record out of the snapshot's array, with every optional field normalised. */
function parseProtocol(v: unknown, i: number): SnapshotProtocol {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
  const p = v as Record<string, unknown>;
  if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
    throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
  }
  return {
    slug: p.slug,
    name: p.name,
    category: stringOrNull(p.category),
    chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
    tvl_usd: p.tvl_usd,
    change_7d: numberOrNull(p.change_7d),
    mcap_usd: numberOrNull(p.mcap_usd),
    listed_at: stringOrNull(p.listed_at),
    gecko_id: stringOrNull(p.gecko_id),
    symbol: stringOrNull(p.symbol),
  };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols: o.protocols.map(parseProtocol),
    watchlist: o.watchlist as string[],
  };
}

/** The coverage issue, if any: every watchlist slug must sit on the board. */
function coverageIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length === 0) return null;
  return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
}

/** The ranking issue, if any: ranks are exactly 1..n and implied value never rises down the board. */
function rankingIssue(board: BoardRow[]): string | null {
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  return null;
}

/** One row's own issue, if any: a sane implied value and a farm plan inside the gate's shape. */
function rowIssue(r: BoardRow): string | null {
  const steps = r.farm_steps;
  if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
  for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
  if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  return null;
}

/** Why a board is not one the gate will take, or null: coverage first, then the ranking, then each row. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const coverage = coverageIssue(board, snapshot);
  if (coverage !== null) return coverage;
  const ranking = rankingIssue(board);
  if (ranking !== null) return ranking;
  for (const r of board) {
    const issue = rowIssue(r);
    if (issue !== null) return issue;
  }
  return null;
}

/** The headline figures for a finished board and the snapshot it came from. */
export function summarizeBoard(board: BoardRow[], snapshot: Snapshot): BoardSummary {
  const watchlist = new Set(snapshot.watchlist);
  return {
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watchlist.has(r.slug)).length,
    live_size: liveRows(snapshot).length,
  };
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
