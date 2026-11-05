# Secure Browser ↔ Local Terminal — Spec (reusable module)

Status: draft v0.1 · Intended to be built as a **standalone project**, then consumed by
Project Control Center (PCC) and any other project that needs a browser-to-local-machine channel.

## 1. Goal

Let a web page (browser) open an interactive terminal / command channel on the user's own
machine with:

- **Mutual authentication** — the local side proves who it is to the browser, and the browser
  proves who it is to the local side.
- **End-to-end encryption** — any relay, tunnel, or host in between (Vercel, Cloudflare, a
  WebSocket relay) sees only ciphertext.
- **Per-session keys** — every session derives fresh keys; compromising a long-term key later
  cannot decrypt past sessions (forward secrecy).
- **A second factor to open a session** — device keys alone are not enough.
- **Reusability** — a small library + daemon with a stable protocol, no PCC-specific code.

### Non-goals

- Not a general SSH replacement, and not a multi-user / multi-tenant system (single owner, N paired devices).
- No custom cryptographic primitives or protocol design. Use Noise + libsodium/WebCrypto only.
- Cannot protect against a compromised endpoint (malware on the laptop, stolen unlocked browser profile).
- "No flaws" is not a promise; the goal is a minimal attack surface built from audited parts.

## 2. Why this exists

Browsers cannot open raw TCP/SSH. The PCC portal is hosted on Vercel and cannot reach the
user's machine. Today PCC uses outbound polling of a Google Sheet (`command_queue`), which has
no inbound exposure but is slow and cannot stream. The agents run with `bypassPermissions`, so
whoever reaches the channel has full control of the projects — the channel must be hardened.

## 3. Components

| Component | Runs on | Responsibility |
|---|---|---|
| **Client lib** (`@scope/secure-term-client`) | Browser | Keys (WebCrypto), pairing UI hooks, Noise handshake, encrypted framing, xterm.js adapter |
| **Daemon** (`secure-term-daemon`) | User's machine | Keys, pairing, Noise handshake, WebAuthn/TOTP verification, spawns PTY, audit log |
| **Relay / transport** | Any (Cloudflare Tunnel, WS relay, Tailscale) | Moves opaque bytes. **Untrusted.** Never holds keys |
| **Host app** (PCC etc.) | Vercel / anywhere | Serves UI, optionally issues a signed session ticket (§6.4) |

The daemon connects **outbound** to the relay, so the machine exposes no listening port.
If a tunnel is used instead, the daemon binds to `127.0.0.1` only.

## 4. Key material

| Key | Type | Where stored | Lifetime |
|---|---|---|---|
| Daemon identity | Ed25519 | OS file, mode 0600 (optionally OS keychain) | Long-term |
| Browser device identity | Ed25519 or ECDSA P-256 (WebCrypto, **non-extractable**) | IndexedDB | Long-term, per device |
| Session ephemerals | X25519 (both sides) | Memory only | One session |
| Session keys | ChaCha20-Poly1305 / AES-256-GCM, via HKDF | Memory only | One session |
| User factor | WebAuthn passkey (preferred) or TOTP | Authenticator | Long-term |

## 5. Pairing (one-time per device)

Pairing is what makes the mutual authentication meaningful. Without it the first connection is
blind trust.

1. User runs `secure-term pair` on the local machine. The daemon prints a **one-time pairing
   code** (≥ 8 chars, high entropy, expires in 2 min, single use) and its public-key fingerprint.
2. In the browser, user enters the code. Browser generates its device keypair.
3. Both sides run a Noise `XXpsk0`-style handshake with the pairing code as the PSK, then
   exchange and **persist each other's long-term public keys**.
4. User confirms that the fingerprint shown in the browser matches the terminal (SAS check).
5. The daemon records the device (name, pubkey, created_at) in an allowlist. Devices can be
   listed and revoked: `secure-term devices`, `secure-term revoke <id>`.

The pairing code is never reused. Failed attempts are rate-limited; 5 failures invalidate it.

## 6. Session protocol

### 6.1 Handshake

Noise `IK` (browser knows the daemon's static key from pairing; daemon verifies the browser's
static key against its allowlist):

1. Browser → Daemon: ephemeral key + encrypted static key (Noise message 1).
2. Daemon → Browser: ephemeral key + daemon challenge nonce (Noise message 2).
3. Both derive session keys via ECDH + HKDF. Keys exist in memory only and are zeroed on close.

Result: both sides authenticated by long-term keys, fresh keys every session, forward secrecy.

### 6.2 Second factor gate

After the handshake, before any PTY is spawned:

- Daemon sends a random challenge; the user must complete **WebAuthn** (passkey tap) or a TOTP
  code, bound to this session's handshake hash so it cannot be replayed on another session.
- Wrong factor ×3 → session closed, device temporarily locked out (exponential backoff).

### 6.3 Encrypted transport

- Every frame: AEAD with a **monotonic counter nonce**; reject out-of-order, duplicate, or
  oversized frames (anti-replay, anti-reorder).
- Frame types: `stdin`, `stdout`, `resize`, `ping`, `close`. Unknown types → close.
- Rekey every N MB or M minutes (Noise `Rekey`).

### 6.4 Optional host-app ticket

The host app (PCC) may add a layer: after its own login, it mints a short-lived signed ticket
(JWT, ≤ 60 s, audience = daemon id) that the daemon verifies before accepting the handshake.
This ties terminal access to the portal login but is **additional**, never a replacement for
the device keys + second factor.

## 7. Session lifecycle & limits

- Idle timeout (default 10 min) and absolute TTL (default 1 h); then close and discard keys.
- Max concurrent sessions: 1 by default.
- Optional command allowlist / read-only mode per device.
- PTY runs as a **dedicated low-privilege user** or inside a sandbox (Docker Sandboxes microVM
  recommended), never as the owner's main account by default.
- Append-only audit log: device id, start/end, source IP as seen by relay, failures. No
  keystroke content by default (opt-in recording).

## 8. Threat model

| Threat | Mitigation |
|---|---|
| Malicious / compromised relay or tunnel | E2E encryption; relay only sees ciphertext |
| Man-in-the-middle at pairing | One-time code as PSK + fingerprint confirmation |
| Replay of captured traffic | Ephemeral keys per session, counter nonces, challenge bound to handshake hash |
| Stolen long-term key, later | Forward secrecy; revoke device |
| Stolen browser device | Second factor required; non-extractable key; revoke |
| Brute-forcing pairing code / TOTP | Rate limits, lockout, single-use code |
| Cross-site WebSocket hijack | Check `Origin`; auth lives in the handshake, not cookies |
| XSS in host app using the unlocked key | CSP, SRI, WebAuthn user-presence per session, short TTL |
| Malicious JS served by a compromised host deploy | SRI/CSP, signed releases, optional pinned standalone client |
| Daemon port exposure | Outbound-only or `127.0.0.1` bind |
| Unvetted dependencies | Few, pinned, audited deps (Noise lib, libsodium) |

Residual risk: endpoint compromise, and trust in the JS delivered to the browser.

## 9. Tech choices

- **Handshake:** Noise Protocol Framework via a maintained library (e.g. `noise-handshake`
  or `@chainsafe/libp2p-noise` for JS). Evaluate `snow` (Rust) if the daemon is not Node.
- **Primitives:** libsodium (`libsodium-wrappers`) and/or WebCrypto. No hand-rolled crypto.
- **Terminal UI:** xterm.js. **PTY:** `node-pty` (Node daemon).
- **Daemon language:** TypeScript/Node to match PCC; Rust is an option for a single static binary.
- **Transport:** abstract `Transport` interface (WebSocket first). Implementations: outbound relay,
  Cloudflare Tunnel (+ Access), Tailscale.

## 10. Public API sketch

```ts
// Browser
const client = await createClient({ transport, deviceStore: indexedDbStore() });
await client.pair({ code });                       // once
const session = await client.connect({ ticket? }); // handshake + 2FA
session.onData(d => term.write(d));
term.onData(d => session.write(d));
session.resize(cols, rows);
session.close();
```

```bash
# Daemon
secure-term start [--relay wss://…] [--bind 127.0.0.1:PORT]
secure-term pair
secure-term devices | revoke <id>
secure-term logs
```

## 11. Integration with PCC

- Replaces / complements `command_queue` polling for the agent console: live streaming of
  `claude` output instead of 10 s polling.
- `apps/agent-bridge` embeds the daemon (or depends on it); `apps/web` uses the client lib in
  the agent console page. Package boundaries from `CLAUDE.md` still hold: the module is its own
  repo/package, `packages/ui` stays presentation-only.
- Pairs with the Docker Sandboxes idea: daemon spawns the PTY via `sbx exec` / ssh into the sandbox.

## 12. Milestones

1. **M1 — Crypto core:** Noise handshake + framing + replay protection, with unit tests and known-answer/negative tests (tampered, replayed, reordered frames).
2. **M2 — Pairing:** one-time code flow, device allowlist, revoke.
3. **M3 — Second factor:** WebAuthn (and TOTP fallback) bound to the handshake hash.
4. **M4 — Daemon PTY + sandbox:** low-privilege/sandboxed shell, limits, audit log.
5. **M5 — Browser client:** xterm.js adapter, IndexedDB key store, reconnect handling.
6. **M6 — Transports:** outbound WS relay; Cloudflare Tunnel guide.
7. **M7 — Hardening:** fuzzing the frame parser, dependency audit, external review, CSP/SRI guidance, threat-model re-check.

## 13. Open questions

- Daemon language: Node (shared code with PCC) vs Rust (static binary, smaller attack surface)?
- Relay: self-hosted tiny WS relay vs Cloudflare Tunnel only?
- WebAuthn only, or keep a TOTP fallback (weaker, no hardware binding)?
- Do we want multi-device simultaneous sessions, or strictly one?
- Keystroke recording: never, opt-in, or always (encrypted at rest)?
- Distribution: npm packages + signed binaries? License?

## 14. Acceptance criteria

- A relay that logs all traffic cannot recover plaintext or inject accepted frames.
- A replayed or reordered frame, or a replayed handshake, is rejected.
- An unpaired or revoked device cannot complete a handshake.
- A paired device without the second factor cannot get a PTY.
- Two sessions never share keys; keys are not written to disk.
- All of the above are covered by automated tests.
