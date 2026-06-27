"use client";

import { useEffect, useState } from "react";
import { SlideShell } from "@/components/SlideShell";
import { Btn, Mono, Panel, Pill, Reveal } from "@/components/ui";
import { bytesToHex, truncateMiddle } from "@/lib/hash";

type Keys = { pub: CryptoKey; priv: CryptoKey; pubHex: string; privHex: string };

export default function KeysSlide() {
  const [keys, setKeys] = useState<Keys | null>(null);
  const [message, setMessage] = useState("Pay Bob 0.5 BTC");
  const [sig, setSig] = useState<ArrayBuffer | null>(null);
  const [sigHex, setSigHex] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);

  async function makeKeys() {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const rawPub = new Uint8Array(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    );
    const pkcs8 = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", pair.privateKey),
    );
    setKeys({
      pub: pair.publicKey,
      priv: pair.privateKey,
      pubHex: bytesToHex(rawPub),
      privHex: bytesToHex(pkcs8),
    });
    setSig(null);
    setSigHex("");
    setValid(null);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    makeKeys();
  }, []);

  async function sign() {
    if (!keys) return;
    const data = new TextEncoder().encode(message);
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keys.priv,
      data,
    );
    setSig(signature);
    setSigHex(bytesToHex(new Uint8Array(signature)));
    setValid(true);
  }

  // re-verify whenever the message changes after signing
  useEffect(() => {
    if (!keys || !sig) return;
    let alive = true;
    crypto.subtle
      .verify(
        { name: "ECDSA", hash: "SHA-256" },
        keys.pub,
        sig,
        new TextEncoder().encode(message),
      )
      .then((ok) => alive && setValid(ok));
    return () => {
      alive = false;
    };
  }, [message, sig, keys]);

  return (
    <SlideShell
      kicker="Foundation 2 · Keys & signatures"
      title="Proving it's you, without a password"
      lede="Ownership in Bitcoin is a pair of keys. The private key is your secret. The public key is your address. A signature ties the two together."
    >
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal className="space-y-4">
          <KeyRow
            tone="red"
            label="Private key (keep secret)"
            value={keys ? truncateMiddle(keys.privHex, 10, 6) : "…"}
          />
          <div className="flex justify-center">
            <span className="text-faint">↓ derives ↓</span>
          </div>
          <KeyRow
            tone="blue"
            label="Public key / address (share freely)"
            value={keys ? truncateMiddle(keys.pubHex, 10, 6) : "…"}
          />
          <Btn variant="ghost" onClick={makeKeys} className="w-full">
            ↻ Generate a new identity
          </Btn>
          <p className="text-sm text-muted">
            The public key comes from the private key — but you can&apos;t go
            backwards. That one-way street is what keeps your secret safe.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <Panel className="p-6">
            <Pill tone="accent">Try it: sign a transaction</Pill>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-faint">
              Message
            </label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              spellCheck={false}
              className="mt-2 w-full rounded-xl border border-border bg-bg-soft px-4 py-3 font-mono text-sm outline-none focus:border-accent"
            />
            <Btn onClick={sign} className="mt-3 w-full">
              ✍ Sign with private key
            </Btn>

            {sigHex && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-faint">
                  Signature
                </div>
                <div className="mt-1 rounded-lg border border-border bg-bg-soft p-3">
                  <Mono tone="muted">{truncateMiddle(sigHex, 24, 18)}</Mono>
                </div>
                <div
                  className={`mt-3 flex items-center gap-2 rounded-lg border p-3 text-sm ${
                    valid
                      ? "border-green/40 bg-green/10 text-green"
                      : "border-red/40 bg-red/10 text-red"
                  }`}
                >
                  {valid ? (
                    <>✓ Valid — the public key confirms this exact message was signed.</>
                  ) : (
                    <>✗ Invalid — the message changed, so the signature no longer matches.</>
                  )}
                </div>
                {valid && (
                  <p className="mt-2 text-xs text-faint">
                    Now edit the message above — the signature instantly becomes
                    invalid. This is how the network knows a payment is genuine
                    and untampered.
                  </p>
                )}
              </div>
            )}
          </Panel>
        </Reveal>
      </div>
    </SlideShell>
  );
}

function KeyRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "blue";
}) {
  const border = tone === "red" ? "border-red/40" : "border-blue/40";
  return (
    <div className={`rounded-xl border ${border} bg-panel/60 p-4`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-faint">
        {label}
      </div>
      <div className="mt-1">
        <Mono tone={tone === "red" ? "default" : "blue"}>{value}</Mono>
      </div>
    </div>
  );
}
