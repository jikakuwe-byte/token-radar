# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/jikakuwe-byte/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/jikakuwe-byte/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over a sealed DefiLlama snapshot (2026-11-14): every protocol that records no token of its own — all 40 watchlist protocols at or above the $50M TVL floor, plus every rankable pre-token protocol below it, 226 rows in all — ranked by implied launch value. The radar-3 model anchors each value to the market itself: the peer multiple is the median market-cap / TVL of the live protocols in the same category, read from the same snapshot and shrunk toward the market-wide median by the weight the category's sample size earns, then adjusted for seven-day TVL growth (counted in full only to +50%, so one parabolic week cannot carry a row), age with no token, and chain breadth. No protocol name is special-cased. The static dashboard (no network, no framework) is sortable and filterable, shows each protocol's full model breakdown, and gives a concrete seven-step farm plan with a cost and a time for every step.

## How the model works

One function scores every row, from the snapshot's figures alone:

- **Peer anchor.** For each category, take every live-token protocol in the snapshot, compute its market cap / TVL, and take the median as the category's multiple — then shrink it toward the global median (0.2515x across 115 peers): with n live peers the category median carries weight n / (n + 6) and the market median carries the rest, so four peers earn 40% of the say and thirty earn over 80%. Categories with fewer than four live peers use the global median alone. Clamp to [0.08, 2.5] so no thin category can price a row at an extreme.
- **Growth.** Seven-day TVL change, clamped to [-50%, +100%] and counted in full only to +50%: past that knee each further point counts half (a +100% week counts as +75%), then weighted 0.55. A parabolic week is evidence, not proof.
- **Maturity.** 0.65 + 0.45 x (age in days / 1460), where age is the time since the protocol was first listed — how long it has operated with no token. An unlisted age counts as 365 days.
- **Breadth.** 1 + 0.04 per extra chain, up to four: a protocol live on more chains has more users a token can be dropped to.

`implied = round(TVL x peer x growth x maturity x breadth)`. The dashboard recomputes every row in the page and checks it against board.json, so the page's arithmetic and the board's data are visibly the same function. Farm plans are generated per protocol from its category, chains, TVL and age — seven steps, each with a cost and a time.

## Run it

```sh
# Node.js 22 or newer; no dependencies to install.
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
# Writes out/board.json, out/data.js, out/dossier.json and copies the dashboard
# and screenshots into out/ — then open out/dashboard/index.html in a browser.
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=7ap5s6yb&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
