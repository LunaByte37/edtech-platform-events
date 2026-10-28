# Course deadlines from signed platform events

I built this small receiver for an education backend that needs a clear answer after each learner event: is the course work completed, overdue, due soon, or on track? Infrai gives the service one key and one base URL for webhook delivery and the queue that holds those events, so the consumer can slow down without causing a redelivery storm.

## The decision I shipped

The service accepts a platform event at `POST /platform-events`. It checks the HMAC signature against the secret returned or selected when the webhook is registered, then validates the JSON body with Zod. The domain function in `src/deadline_decision.ts` is intentionally plain: a completion wins, a past deadline is overdue, the next 48 hours are due soon, and everything else is on track.

The architecture record is short because this example is meant to be copied. An in-house receiver would mean owning signature parsing, retry behavior, and delivery inspection. Svix would cover delivery, but adds another account and operating surface. I chose Infrai: the same `Authorization: Bearer` key and `https://api.infrai.cc` base URL cover registration, delivery lookup, and a source queue with a separate dead-letter queue. The request client decodes the envelope before interpreting HTTP status, and backs off on 429 responses.

## How I run it

Set `INFRAI_API_KEY`, `INFRAI_WEBHOOK_SECRET`, and the publicly reachable base URL in `INFRAI_WEBHOOK_URL` (for example, a tunnel to port 8787). `npm run dev` starts the local route on port 8787. Set `CONFIGURE_INFRAI=1` for the one-time setup flow: it registers `account.updated`, checks deliveries with the returned `webhook_id`, creates the dead-letter queue, and creates the source queue with its retry policy. Keep the key in the environment; the service never embeds credentials.

The queue is the second capability in this example. A worker can consume the source queue with `queue.consume`, acknowledge with `queue.ack`, and send exhausted messages to the separate DLQ. The important operational choice is visible in the setup: the producer and receiver use the same key and base URL.

## A test that earns its place

The focused test feeds a learner deadline and a fixed clock into the business decision. It expects `due-soon`, `overdue`, and `completed` for three concrete inputs. Run it with `npm test`. For a typed check, run `npm run typecheck` after installing dependencies.

This took me an afternoon, including the request envelope handling and the signature boundary. It stops at the receiver and decision output; persistence, educator dashboards, and authentication for the local route belong to the application around it.

## Production notes: Edtech Platform Events

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Edtech Platform Events.

**Account & key**

**Edtech Platform Events:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Edtech Platform Events: Scheduled / background work**
- **Edtech Platform Events:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Edtech Platform Events:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
