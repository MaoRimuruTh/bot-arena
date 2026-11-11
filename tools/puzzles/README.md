# Puzzles

Puzzles ("win before this turn ends") are positions from bot-vs-bot games between the Starter Decks.

`miner.js` plays the games in the browser with the real rules engine and the live card data. At the start of each main phase where the other side is nearly out of LIFE, it empties that side's hand and searches every line for the side to play (`solveTurn` in `js/puzzles.js`). Every defence that is left is tried, so a puzzle it keeps can be won whatever the other side does. For each one it also records:

- whether the plain bot wins the turn on its own
- how many first moves still lead to a win

`build.cjs` chooses a few gentle puzzles and then ones the bot misses, and writes `js/puzzles-data.js`. Only card numbers and table positions are written. Names, text and art load live from the official site like everywhere else in the app.

To run the miner, serve the repo root over http and open any page of the app so the card data loads. Then, from the console or Playwright:

```js
const m = await import("/tools/puzzles/miner.js?v=<the stamp in index.html>");
const res = await m.mine(300, 5000);   // games, first seed
// save JSON.stringify(res.found) to mined.json, then: node tools/puzzles/build.cjs mined.json
```
