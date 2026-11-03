# Trips

How to model the stores, dates and tools of a purchase plan, and how to make the trips easy to follow. [engine/docs/format.md](../engine/docs/format.md) defines every field. This file says how to choose the values.

## Contents

1. [Stores](#1-stores)
2. [Lead times and order-by dates](#2-lead-times-and-order-by-dates)
3. [Buy, rent or borrow](#3-buy-rent-or-borrow)
4. [Transport and delivery](#4-transport-and-delivery)
5. [Split or merge trips](#5-split-or-merge-trips)
6. [A plan with steps](#6-a-plan-with-steps)
7. [Problems and fixes](#7-problems-and-fixes)

## 1. Stores

`stores` maps an id to `{ name, online?, lead?, note?, url? }`.

| Field | How to choose it |
|---|---|
| `name` | What the reader calls it: "Timber yard", "DIY store", "Online order". Use a real store name only when the user names it |
| `online` | `true` for a delivery to the door. Online trips come first, because they need lead time |
| `lead` | Days from the order to the delivery. Leave it out for a store the reader walks into |
| `note` | One instruction for the trip, in STE: "Pick straight boards. Look along each edge before you buy it." |
| `url` | The store page the user gave, starting with `http://` or `https://`. Never invent one |

Useful trip notes:

- Timber: "Pick straight boards. Look along each edge before you buy it."
- Sheets: "Ask the store to cut the sheet. Take the cut plan with you."
- Finish: "Ask the store to shake the tin."
- Tool hire: "Ask the store to show how the tool works. Ask for a new blade."

## 2. Lead times and order-by dates

- With `--start YYYY-MM-DD`, each trip gets an order-by date: the start date minus `lead` days. Days are calendar days.
- The engine has no clock, so you supply the date. If the user says "Saturday" or "next weekend", work out the date from today's date, and say it back with the weekday.
- If an order-by date is before today, say so first. Offer three choices: a local store for those items, faster delivery, or a later start.
- Use the lead time the store states. Else use these starting values, and mark them as estimates:

| Order | Lead |
|---|---|
| Online hardware: screws, hinges, brackets | 2 to 5 days |
| Online finishes and glue | 3 to 7 days |
| Timber yard or builders' merchant delivery | 2 to 7 days |
| Special-order sheets: hardwood plywood, 2500 x 1250 mm, thick sheets | 7 to 21 days |
| Tool hire for a weekend | Book 1 to 2 days before |

- A store with a long lead and a short list is a risk: one late parcel stops the build. If a local store sells the same item, offer it.

## 3. Buy, rent or borrow

| Choice | Fields | Cost |
|---|---|---|
| The user has it | `have: true` | Not on the list |
| Buy | `get: "buy"` (default), `price`, `qty` | qty x price |
| Rent | `get: "rent"`, `price` (one day), `days`, `qty` | qty x days x price |
| Borrow | `get: "borrow"` | 0, on the Borrow trip |

Choose with these numbers:

- Rent when the tool costs more than 4 times its day rate and the build needs it for 1 or 2 days.
- Buy when the user will use the tool again, or when it costs less than 3 day rates.
- Borrow when a friend, a neighbour or a tool library has it. A tool library often lends for 1 week at no cost.
- A hire store often charges for blades, discs and a deposit. Add a blade as an `each` material when the hire price does not include it.
- `days` counts hire days. A weekend hire is often priced as 1 day; use the store's rule.
- A power tool from a hire store or a friend: tell the user to ask for a short demonstration, and to wear the protective equipment on the list.

## 4. Transport and delivery

- Boards over 2.4 m (8 ft) and full sheets (2440 x 1220 mm, 4 x 8 ft) do not fit in most cars. Ask how the user carries them.
- Choices: store delivery, store cutting (the jig-cut plan tells the store where to cut), a roof rack, a borrowed van, or a hire van.
- A full 2440 x 1220 x 18 mm sheet weighs about 30 kg in plywood and 40 kg in MDF. Lift a full sheet, a part over 20 kg (45 lb) or a board over 2.4 m (8 ft) with a helper.
- Model a delivery fee as an `each` material in its own group, with its store, and count it in `uses`:

```json
"materials": {
  "delivery": { "kind": "each", "name": "Delivery", "group": "Delivery", "price": 15, "store": "yard" }
},
"uses": { "delivery": 1 }
```

- The fee then goes on that store's trip and in the BOQ with an `O` code.

## 5. Split or merge trips

- One store for each item. If two stores sell it, pick the one on a trip the reader makes anyway.
- Merge a trip that holds 1 or 2 small items into another trip, when that store sells them for about the same price (within 10%).
- Keep timber and sheets at the store with the best stock: straight boards save more than a small price difference.
- Keep online orders for items that local stores do not sell, or that cost much less online (more than 20%).
- After each change, run `buy` again. Never move an item by hand in the output.

## 6. A plan with steps

A project from jig-plan or jig has steps. The purchase plan then uses them:

- Each item shows the step that first needs it. The reader can split a trip: buy the timber now, and the finish before the finish step.
- Items in a trip follow that order.
- A tool shows its first step too. Buy or borrow it before that step.
- Set `cuts` on the step that cuts the stock, so the boards are needed by that step and not by the first step.

A project with no steps (a list for a quote) has no first step. Its trips follow the lead time, then the store name.

## 7. Problems and fixes

| Code | Usual cause | Fix |
|---|---|---|
| `W_UNKNOWN_STORE` | A `store` id not in `stores`, or a typo | Fix the id, or add the store. Until then, the item is on the "Any store" trip |
| `W_PRICE_UNKNOWN` | A tool to buy or rent with no price | Add an estimate, or set it `have: true` or `get: "borrow"` |
| `W_UNUSED_TOOL` | A tool that no step uses. A project with no steps gives no such warning | Add the tool to the step that needs it, or remove it. The shopping list keeps an unused tool |
| `E_SCHEMA` | `lead` in quotes, `get: "hire"`, a store `url` that does not start with `http://` or `https://` | Follow the hint. `get` is `buy`, `rent` or `borrow` |
| `E_REF` | A part names a material that does not exist | Fix the id, or add the material |
| Exit code 2 | `--start` not written as `YYYY-MM-DD` | Write the date as `2026-11-14` |
