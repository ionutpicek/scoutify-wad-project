import test from "node:test"
import assert from "node:assert/strict"

import { __test__ } from "./extractMatchStatsFieldPlayers.js"

function extractDuelsStatsFromTail(tail) {
  const statsByPlayer = {}
  const ratios = __test__.parseRatioTail(tail, 10)
  __test__.applyDuelsRatios(statsByPlayer, "Player", ratios)
  return statsByPlayer.Player?.stats || {}
}

function parseRatios(tail) {
  return __test__.parseRatioTail(tail, 30)
}

function extractMainTableStatsFromTail(tail) {
  const statsByPlayer = {}
  const ratios = parseRatios(tail)
  __test__.applyTableRatios(statsByPlayer, "Player", ratios)
  return statsByPlayer.Player?.stats || {}
}

function extractPassingStatsFromTail(tail) {
  const statsByPlayer = {}
  const parsed = __test__.parsePassingTail(tail)
  __test__.applyPassingRatios(statsByPlayer, "Player", parsed.ratios, parsed.counts)
  return statsByPlayer.Player?.stats || {}
}

test("findDuelsAnchors matches only player duels split header, not team summary lines", () => {
  const lines = [
    "Interceptions3737",
    "Clearances1615",
    "Defensive duels / won124/8770%112/8475%",
    "Loose ball duels / won43/1535%43/1944%",
    "Player",
    "Minutes",
    "played",
    "Defensive duels/",
    "won",
    "Offensive duels/",
    "won",
    "Aerial duels /",
    "won"
  ]

  assert.deepEqual(__test__.findDuelsAnchors(lines), [7])
})

test("duels parser extracts aerial/interceptions/clearances/fouls when shots blocked is omitted", () => {
  const stats = extractDuelsStatsFromTail("12/650%3/133%2/150%3/00%14/31/00%2/1----")

  assert.deepEqual(stats.defensiveDuels, { attempts: 12, success: 6 })
  assert.deepEqual(stats.offensiveDuels, { attempts: 3, success: 1 })
  assert.deepEqual(stats.aerialDuels, { attempts: 2, success: 1 })
  assert.deepEqual(stats.looseBallDuels, { attempts: 3, success: 0 })
  assert.deepEqual(stats.interceptions, { attempts: 14, success: null })
  assert.deepEqual(stats.clearances, { attempts: 3, success: null })
  assert.deepEqual(stats.slidingTackles, { attempts: 1, success: 0 })
  assert.deepEqual(stats.fouls, { attempts: 2, success: null })
  assert.deepEqual(stats.foulsSuffered, { attempts: 1, success: null })
})

test("duels parser keeps correct alignment when shots blocked has placeholder and sliding is missing", () => {
  const stats = extractDuelsStatsFromTail("7/571%4/00%2/150%4/4100%-7/6-2/0----")

  assert.deepEqual(stats.defensiveDuels, { attempts: 7, success: 5 })
  assert.deepEqual(stats.offensiveDuels, { attempts: 4, success: 0 })
  assert.deepEqual(stats.aerialDuels, { attempts: 2, success: 1 })
  assert.deepEqual(stats.looseBallDuels, { attempts: 4, success: 4 })
  assert.deepEqual(stats.interceptions, { attempts: 7, success: null })
  assert.deepEqual(stats.clearances, { attempts: 6, success: null })
  assert.equal(stats.slidingTackles, undefined)
  assert.equal(stats.fouls.attempts, 2)
  assert.equal(stats.foulsSuffered.attempts, 0)
})

test("duels parser does not invent interceptions/clearances when only fouls pair remains", () => {
  const stats = extractDuelsStatsFromTail("2/2100%10/550%-2/2100%---0/2----")

  assert.deepEqual(stats.defensiveDuels, { attempts: 2, success: 2 })
  assert.deepEqual(stats.offensiveDuels, { attempts: 10, success: 5 })
  assert.deepEqual(stats.aerialDuels, undefined)
  assert.deepEqual(stats.looseBallDuels, { attempts: 2, success: 2 })
  assert.deepEqual(stats.interceptions, undefined)
  assert.deepEqual(stats.clearances, undefined)
  assert.deepEqual(stats.slidingTackles, undefined)
  assert.equal(stats.fouls.attempts, 0)
  assert.equal(stats.foulsSuffered.attempts, 0)
})

test("main table card parser prefers yellow/red card ratio over earlier extra ratios", () => {
  // indexes 0..9 = goals/assists/actions + 7 tracked columns, then extras:
  // idx10 could be a touches/offsides-like ratio, idx11 is Yellow/Red cards
  const ratios = parseRatios("1/0.101/0.2070/5070%3/160%30/2480%2/150%4/250%12/650%10/440%11/01/0")
  const picked = __test__.pickYellowRedCardToken(ratios, 10)

  assert.deepEqual(picked, { attempts: 1, success: 0 })
})

test("main table card parser de-glues minute-like yellow token 11/0 into 1/0", () => {
  const ratios = parseRatios("0/0.00-25/1248%1/00%14/964%-1/1100%8/338%4/14/2--11/0")
  const picked = __test__.pickYellowRedCardToken(ratios, 10)

  assert.deepEqual(picked, { attempts: 1, success: 0 })
})

test("Laura Rus row pattern from Politehnica vs Unirea PDF keeps yellow cards as 1 not 11", () => {
  const tail = "0/0.110/0.4273/3852%2/2100%33/2164%2/150%4/375%33/1545%21/49/7111/0"
  const ratios = parseRatios(tail)
  const picked = __test__.pickYellowRedCardToken(ratios, 10)

  assert.deepEqual(picked, { attempts: 1, success: 0 })
})

test("main table parser extracts touches in penalty area and offsides before cards", () => {
  const stats = extractMainTableStatsFromTail("1/0.05 0/0.10 74/52 1/0 57/46 5/3 8/4 17/7 17/8 9/7 4/1 1/0")

  assert.deepEqual(stats.touchesInPenaltyArea, { attempts: 4, success: null })
  assert.deepEqual(stats.offsides, { attempts: 1, success: null })
  assert.deepEqual(stats.yellowCards, { attempts: 1, success: null })
  assert.deepEqual(stats.redCards, { attempts: 0, success: null })
})

test("passing parser extracts back/long passes and second/shot assists", () => {
  const stats = extractPassingStatsFromTail("37/2670%8/675%19/1789%61/4879%10/550%21/1048%5/360%-----19.8")

  assert.deepEqual(stats.forwardPasses, { attempts: 37, success: 26 })
  assert.deepEqual(stats.backPasses, { attempts: 8, success: 6 })
  assert.deepEqual(stats.longPasses, { attempts: 10, success: 5 })
  assert.deepEqual(stats.progressivePasses, { attempts: 21, success: 10 })
  assert.deepEqual(stats.passesFinalThird, { attempts: 5, success: 3 })
  assert.equal(stats.secondAssists, undefined)
  assert.equal(stats.shotAssists, undefined)
})

test("passing parser extracts second assists from compact trailing counts when OCR glues them", () => {
  const stats = extractPassingStatsFromTail("15/1280%8/8100%11/873%38/3592%6/350%5/5100%5/360%2/150%11-417")

  assert.deepEqual(stats.secondAssists, { attempts: 4, success: null })
})
