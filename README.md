# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/jikakuwe-byte/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/jikakuwe-byte/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over a sealed DefiLlama snapshot (2026-11-14): every protocol that records no token of its own — all 40 watchlist protocols at or above the $50M TVL floor, plus every rankable pre-token protocol below it, 226 rows in all — ranked by implied launch value. The radar-2 model anchors each value to the market itself: the peer multiple is the median market-cap / TVL of the live protocols in the same category, read from the same snapshot, then adjusted for seven-day TVL growth, age with no token, and chain breadth. No protocol name is special-cased. The static dashboard (no network, no framework) is sortable and filterable, shows each protocol's full model breakdown, and gives a concrete seven-step farm plan with a cost and a time for every step.

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
