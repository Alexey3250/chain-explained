# Chain, Explained ⛓️

An interactive, slide-by-slide walkthrough of **how Bitcoin actually works** — built for visual learners. Start from a single hash and zoom all the way out to a global network that no one owns. Every hash, signature, and mined block on the slides is computed **for real, in your browser**, and the final slide shows **live data from the Bitcoin network**.

🔗 **Live:** _(deploying — link added after first deploy)_

![Built with Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-149eca) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8)

## What's inside

A guided deck (←/→ to navigate, deep-linkable via URL hash) that builds understanding one idea at a time:

1. **The problem** — why digital money is hard (double-spending)
2. **The hash** — a live SHA-256 box; type and watch the avalanche effect
3. **Keys & signatures** — generates a real ECDSA keypair, signs a message, and verifies it (edit the message → the signature breaks)
4. **Transactions** — the inputs/outputs (UTXO) model
5. **Blocks** — how transactions are bundled and linked
6. **Proof of work** — an in-browser miner that hashes until it finds a valid nonce (adjustable difficulty)
7. **Immutability** — a tamper-the-chain demo: edit a block and watch every block after it turn red
8. **The network** — nodes, propagation, and consensus
9. **The big picture** — a recap, plus **live** block height, fees, and mempool size from [mempool.space](https://mempool.space)

## Tech

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** for styling
- **Motion** (Framer Motion's successor) for animation
- **Web Crypto API** — all hashing and signing is genuine, no libraries faking it
- Deployed on **Vercel**

The slideshow engine ([`src/components/Deck.tsx`](src/components/Deck.tsx)) handles keyboard/touch navigation, progress, and URL-hash deep-linking. Each slide is a self-contained component under [`src/slides/`](src/slides), registered in [`src/slides/index.ts`](src/slides/index.ts) — adding a slide is a one-line change.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Roadmap

- Ethereum chapter (accounts, gas, smart contracts)
- Pre-rendered deep-dive animations for the trickier ideas
- Live transaction-flow visualization

---

Built as a learning project and portfolio piece. PRs and ideas welcome.
