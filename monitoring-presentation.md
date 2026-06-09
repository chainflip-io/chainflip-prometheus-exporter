---
marp: true
theme: default
paginate: true
footer: 'Chainflip · Monitoring & Observability'
title: Monitoring & Observability at Chainflip
---

<style>
/* ── Chainflip light theme — tweak --accent to rebrand ───────────── */
:root {
  --accent: #ff2d78;
  --accent-dark: #c81f60;
  --ink: #1f2430;
  --muted: #5b6472;
  --bg: #ffffff;
  --code-bg: #f4f5f7;
  --border: #e6e8ec;
}

section {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
  color: var(--ink);
  background: var(--bg);
  font-size: 25px;
  line-height: 1.42;
  padding: 56px 68px 64px;
}

/* Slide titles */
section h2 {
  font-size: 1.5em;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 .6em;
  padding-bottom: .22em;
  border-bottom: 3px solid var(--accent);
}
section h3 { color: var(--muted); font-weight: 600; }

/* Links + lists */
section a { color: var(--accent-dark); text-decoration: none; }
section strong { color: var(--ink); font-weight: 700; }
section ul, section ol { margin-top: .15em; }
section li { margin: .26em 0; }
section li::marker { color: var(--accent); }

/* Inline code (kept neutral — slides are code-dense) */
section code {
  font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
  background: var(--code-bg);
  color: #374151;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: .03em .34em;
  font-size: .85em;
}

/* Code blocks */
section pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: .8em 1em;
  font-size: .8em;
  line-height: 1.4;
  box-shadow: 0 1px 2px rgba(16,24,40,.05);
}
section pre code { background: none; border: 0; color: #2b3445; padding: 0; font-size: 1em; }

/* Blockquote */
section blockquote {
  border-left: 4px solid var(--accent);
  margin: .4em 0;
  padding: .15em 0 .15em 1em;
  color: var(--ink);
  font-style: normal;
}

/* Pagination + footer */
section::after { color: var(--muted); font-size: .6em; }
section footer { color: var(--muted); font-size: .62em; opacity: .85; }

/* Title / lead slide */
section.lead {
  display: flex; flex-direction: column; justify-content: center;
  text-align: left; padding-left: 88px;
}
section.lead h1 {
  font-size: 2.4em; line-height: 1.1; color: var(--ink);
  border-left: 10px solid var(--accent); padding-left: .38em; margin: 0 0 .12em;
}
section.lead h3 { color: var(--muted); font-weight: 500; margin: 0 0 .2em; }

/* Wide ASCII architecture diagram */
section.diagram pre { font-size: .62em; line-height: 1.25; }
</style>

<!--
This deck is Marp-compatible: `npx @marp-team/marp-cli monitoring-presentation.md -o deck.html`
(or use the "Marp for VS Code" extension to preview/export to PDF/PPTX).
Slides are separated by `---`. HTML comments are speaker notes.
Theme lives in the <style> block above — change --accent to rebrand.
-->

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: '' -->

# Monitoring & Observability at Chainflip

### How we know what the network is doing

<br>

**Two pillars:** Prometheus (metrics) · Loki (logs)
**On top:** Grafana (dashboards) · Alertmanager (alerts)

<!--
Goal of the talk: explain how metrics and logs flow from every part of our
infra into a queryable store, get visualized, and turn into alerts that reach
the right people.
-->

---

<!-- _class: diagram -->

## The big picture

```
   SOURCES                         COLLECT / STORE            CONSUME
 ┌────────────────────┐
 │ Chainflip nodes    │── /metrics ─┐
 │ Chainflip engines  │── /metrics ─┤
 │ CF network*        │── /metrics ─┼──► PROMETHEUS ──┐──► GRAFANA (dashboards)
 │ Deposit monitor    │── /metrics ─┤   (metrics TSDB)│
 │ Kubernetes clusters│── /metrics ─┘                 │
 └────────────────────┘                               ├──► ALERTMANAGER ──► Discord
                                                       │       (alerts)       PagerDuty
 ┌────────────────────┐    push (Alloy/agents)         │                      Slack/email
 │ Logs from all above│──────────────► LOKI ───────────┘
 └────────────────────┘                (logs)
```

\* the Chainflip **network** is observed via our **chainflip-prometheus-exporter**

<!--
Key framing: Prometheus and Loki are deliberately the *same* mental model —
label-based selection, the same Alertmanager. One does metrics (pull), the
other does logs (push). Grafana queries both for dashboards.
-->

---

## Prometheus — what it is

- Open-source **metrics monitoring** system + **time-series database**.
- **Pull-based:** Prometheus *scrapes* an HTTP `/metrics` endpoint on each target every `scrape_interval`.
- Each target just exposes its current values as plain text in the **Prometheus exposition format** — one `metric_name{labels} value` line per metric; Prometheus does the collecting & storing.

<!--
Contrast with push systems: targets don't send data anywhere; they sit there
exposing /metrics and Prometheus comes and gets it. This makes each Prometheus
server self-contained and reliable — no dependency on the network to function.
For short-lived batch jobs that can't be scraped there's the Pushgateway, but
that's the exception, not the rule.
-->

---

## Prometheus — data model & PromQL

- A **time series** = a metric name + a set of key/value **labels**.
  `cf_block_height{chain="ethereum", network="mainnet"}`
- A **sample** = `(timestamp, value)`.
- Changing *any* label value creates a **new, distinct** series.
- ⚠️ **Cardinality matters:** never put unbounded values (user IDs, tx hashes) in labels — every combination is its own series and memory explodes.
- **PromQL** — Prometheus's functional query language for selecting & aggregating these series in real time, e.g. `rate(cf_events_count_total[5m])` or `sum by (chain) (...)`.
- **Storage:** local on-disk TSDB with short retention; long-term → remote-write to **VictoriaMetrics**.

<!--
The label set IS the identity of the series — metric name is just the special
__name__ label under the hood. Cardinality explosion is the #1 operational
footgun, worth stressing. PromQL is how Grafana dashboards and alerting rules
both query this data — same language everywhere.
-->

---

## How our sources expose metrics

- **Chainflip nodes & engines** — expose their own `/metrics` directly.
- **Kubernetes** — `node_exporter` (host) + `kube-state-metrics` (cluster objects); Prometheus auto-discovers pods via k8s service discovery.
- **Deposit monitor** — instrumented service exposing `/metrics`.
- **The Chainflip network itself** has no `/metrics` — on-chain state isn't an HTTP target. → that's the job of our **chainflip-prometheus-exporter**.

<!--
Everything that can speak Prometheus does so directly. The one gap is the
blockchain state itself — you can't scrape a chain. So we built a translator.
-->

---

## Our component: the chainflip-prometheus-exporter

- A **Node/TypeScript** service that reads **on-chain data & state**, turns it into Prometheus metrics.
- **7 chain watchers**, each with its own registry, individually toggled per network (localnet / perseverance / berghain / mainnet):

  **Chainflip State Chain** · **Ethereum** · **Bitcoin** · **Arbitrum** · **Solana** · **AssetHub** · **Tron**

- Also exposes **`/health/block-lag`** probes that flag when an external chain's witnessing falls behind its real chain tip.

<!--
This is "our" piece — spend the most time here since the audience owns it.
The State Chain watcher is via @polkadot/api calling a custom monitoring_data
RPC; external chains via ethers / bitcoin-core / @solana/web3.js / tronweb.
-->

---

## What the exporter measures

**State Chain (`cf_*`) — the richest source:**
- Chain health: `cf_block_height`, `cf_external_chain_block_height{tracked_chain=...}`, reorg detection
- Validators/epoch: `cf_authorities`, `cf_authorities_online`, `cf_suspended_validators`, `cf_reputation`
- Operations: rotations, `cf_swapping_queue`, `cf_open_deposit_channels`, `cf_pending_redemptions`, broadcasts
- Economics: `cf_flip_total_supply`, fees, lending/LTV (`cf_ltv_ratio_histogram`), oracle prices

**External chains:** block height + balances (`eth_balance`, `eth_token_balance`, `sol_balance`, `tron_trx_balance`)

<!--
Pick 2-3 of these to show live on a Grafana dashboard if you can. The point:
one service gives us a metrics-eye view of the whole protocol.
-->

---

## Code structure

```
src/
├── app.ts      # entry
├── watchers/   # one service per chain — the polling / subscription loop
├── metrics/    # metric definitions, grouped by chain (chainflip, eth, btc, sol, …)
├── config/     # load & validate per-network settings
...
```

Each file in `metrics/<chain>/` does two things — **define** the metric (name, help, type) and **transform** on-chain data into a Prometheus sample. The chain's **watcher** calls it on every new block / poll with freshly-read `data`.

➡️ **Adding a metric** = define it in `metrics/<chain>/`, then populate it from that chain's `watchers/<chain>.ts`.

<!--
The mental model: watchers fetch, metrics define, app wires them together per
chain — to add something you touch just two folders, metrics/ and watchers/.
The metric function is where raw state-chain JSON becomes a Prometheus number.
Extras to mention if asked: labels (.labels(address).set(...)) create one
series per entity; a skipMetrics config flag can disable any metric; the body
is wrapped in try/catch that flips a cf_*_failure metric so we can alert on
scrape errors. Each chain has its own registry, enabled/disabled via config.
-->

---

## Loki — logs, the Prometheus way

- **"Like Prometheus, but for logs"** 
- **Indexes only labels** (service, namespace, pod…), not full log text → raw lines. Cheap & simple vs full-text systems like Elasticsearch.
- **Push-based:** agents ship logs to Loki — **Promtail**
- **LogQL** mirrors PromQL: same `{label="value"}` selectors, can turn logs into metrics (`rate`, `count_over_time`).
- Loki's **ruler** can alert on logs and sends to the **same Alertmanager**.

<!--
Theme to land: Loki reuses the Prometheus model end-to-end — selectors, rule
format, and Alertmanager — but flips ingestion to push and indexes labels only.
Same dashboards (Grafana) and same alerting backend.
-->

---

## Alerting — how an alert is born (Prometheus side)

1. We **define alerting rules** = PromQL expressions with labels + annotations.
   ```yaml
   - alert: EthBlockLagHigh
     expr: (eth_block_height - on(...) cf_external_chain_block_height{tracked_chain="ethereum"}) > 300
     for: 5m
     labels: { severity: critical }
     annotations: { summary: "ETH witnessing lagging" }
   ```
2. Every **`evaluation_interval`** Prometheus evaluates the expression.
3. Condition true → alert is **pending**; stays true for the **`for`** duration → **firing**. *(This `for` clause kills transient spikes / flapping.)*
4. Prometheus **pushes** firing alerts to **Alertmanager** (and keeps re-sending while active).

<!--
States: inactive → pending → firing. The `for` clause is the single most
important nuance people forget. Labels drive routing; annotations are the
human-readable text.
-->

---

## Alertmanager — dedup, route, notify

Prometheus decides *what* is wrong; **Alertmanager decides who hears about it and how.** Five jobs:

- **Grouping** — batch related alerts into one notification (`group_by`).
- **Deduplication** — collapse identical alerts
- **Inhibition** — suppress noise when a bigger alert fires (mute per-node alerts when the whole cluster is down).
- **Silencing** — time-boxed manual muting (maintenance windows).
- **Routing** — a **routing tree** matches alert labels → a **receiver**.

**Receivers:** Discord (which channel via the route), **PagerDuty (PD)**, webhooks.

<!--
Routing tree is label-based: e.g. severity=critical → PagerDuty + #alerts-critical;
severity=warning → just a Discord channel. group_wait buffers the first burst;
repeat_interval is the "still broken, reminding you" cadence.
-->

---

## Where to find things

Want to extend the monitoring yourself? Three repos:

- **`chainflip-prometheus-exporter`** — to add **metrics** about the Chainflip network or external-chain–specific things (e.g. Solana durable nonces, a new balance, a new chain watcher).
- **`chainflip-alerting`** — to add or tune **alerts** (the PromQL/LogQL rules)
- **`chainflip-cluster-configuration`** — to update **Alertmanager** config & **routing** (which receiver / Discord channel / PagerDuty an alert lands in).

<!--
Leave-behind slide: where the audience goes next. Metrics live in the exporter,
alert rules live in chainflip-alerting, and Alertmanager config + routing live
in chainflip-cluster-configuration.
-->

---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: '' -->

# Questions?
