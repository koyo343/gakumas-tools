import { S } from "../constants";
import { deepCopy } from "../utils";
import HeuristicStrategy from "./HeuristicStrategy";

const DEFAULTS = {
  beamWidth: 12,
  samples: 4,
  maxDepth: 6,
  maxSearchNodes: 1200,
  targetScore: null,
  deckOrder: "unknown",
};

const MAXIMUMS = {
  beamWidth: 64,
  samples: 32,
  maxDepth: 20,
  maxSearchNodes: 10000,
};

const DECK_ORDERS = ["unknown", "known"];
const PLANNING_PILES = {
  handCards: S.handCards,
  deckCards: S.deckCards,
  discardedCards: S.discardedCards,
  removedCards: S.removedCards,
  heldCards: S.heldCards,
  pDrinks: S.pDrinks,
};

const KEY_FIELDS = [
  "turnsRemaining",
  "cardUsesRemaining",
  "stamina",
  "genki",
  "score",
  "consumedStamina",
  "consumedGenki",
  "goodConditionTurns",
  "perfectConditionTurns",
  "concentration",
  "goodImpressionTurns",
  "motivation",
  "fullPowerCharge",
  "stance",
  "prevStance",
  "lockStanceTurns",
  "halfCostTurns",
  "doubleCostTurns",
  "doubleBuffCostTurns",
  "costReduction",
  "costIncrease",
  "nullifyCostCards",
  "nullifyCostActiveCards",
  "nullifyGenkiTurns",
  "poorConditionTurns",
  "scoreBuffs",
  "scoreDebuffs",
  "goodImpressionTurnsBuffs",
  "goodImpressionTurnsEffectBuffs",
  "concentrationBuffs",
  "concentrationAdditionBuffs",
  "motivationBuffs",
  "motivationAdditionBuffs",
  "strengthEffectBuffs",
  "fullPowerEffectBuffs",
  "handCards",
  "deckCards",
  "discardedCards",
  "removedCards",
  "heldCards",
  "pDrinks",
  "cardsUsed",
  "activeCardsUsed",
  "turnCardsUsed",
  "examCardsUsed",
  "usedCard",
  "lastUsedCard",
  "usedDrink",
  "effects",
  "effectCounters",
];

function valueKey(value) {
  if (Array.isArray(value)) return value.map(valueKey);
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (
        key !== "logs" &&
        key !== "graphData" &&
        key !== "cardMap" &&
        key !== "cardPriorities"
      ) {
        result[key] = valueKey(value[key]);
      }
    }
    return result;
  }
  return value;
}

function makeStateKey(state) {
  const key = {};
  for (const field of KEY_FIELDS) {
    key[field] = valueKey(state[S[field]]);
  }
  return JSON.stringify(key);
}

function shuffleCopy(cards) {
  const result = cards.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function percentile(values, ratio) {
  if (values.length === 0) return -Infinity;
  const index = Math.min(
    values.length - 1,
    Math.floor((values.length - 1) * ratio),
  );
  return values.slice().sort((a, b) => a - b)[index];
}

function actionKey(action) {
  if (action.type === "card") return `card:${action.card}`;
  if (action.type === "drink") return `drink:${action.drinkIndex}`;
  return "endTurn";
}

export default class ProbabilisticBeamStrategy extends HeuristicStrategy {
  constructor(engine, options = {}) {
    super(engine);
    this.options = { ...DEFAULTS, ...options };
    for (const field of ["beamWidth", "samples", "maxDepth", "maxSearchNodes"]) {
      if (
        !Number.isInteger(this.options[field]) ||
        this.options[field] < 1 ||
        this.options[field] > MAXIMUMS[field]
      ) {
        throw new Error(
          `Probabilistic beam option "${field}" must be an integer from 1 to ${MAXIMUMS[field]}`,
        );
      }
    }
    if (
      this.options.targetScore != null &&
      (!Number.isFinite(this.options.targetScore) || this.options.targetScore < 0)
    ) {
      throw new Error("Probabilistic beam option \"targetScore\" must be a non-negative number");
    }
    if (!DECK_ORDERS.includes(this.options.deckOrder)) {
      throw new Error(
        `Probabilistic beam option "deckOrder" must be one of: ${DECK_ORDERS.join(", ")}`,
      );
    }
    this.lastRecommendation = null;
  }

  /**
   * Create an isolated planning state from the current engine state.
   *
   * The UI can use this when it starts accepting manually entered piles.
   * Card values must be the same card ids used by the engine state.
   */
  createPlanningState(state, piles = {}) {
    const planningState = deepCopy(state);
    for (const [pileName, field] of Object.entries(PLANNING_PILES)) {
      if (piles[pileName] === undefined) continue;
      if (!Array.isArray(piles[pileName])) {
        throw new Error(`Planning pile "${pileName}" must be an array`);
      }
      planningState[field] = deepCopy(piles[pileName]);
    }
    return planningState;
  }

  getActions(state) {
    const actions = [];
    for (const card of state[S.handCards]) {
      if (this.engine.isCardUsable(state, card)) {
        actions.push({ type: "card", card });
      }
    }

    for (let drinkIndex = 0; drinkIndex < (state[S.pDrinks] || []).length; drinkIndex++) {
      actions.push({ type: "drink", drinkIndex });
    }

    actions.push({ type: "endTurn" });
    return actions;
  }

  applyAction(state, action) {
    switch (action.type) {
      case "card":
        return this.engine.useCard(state, action.card);
      case "drink":
        return this.engine.useDrink(state, action.drinkIndex);
      case "endTurn":
        return this.engine.endTurn(state);
      default:
        throw new Error(`Unknown beam search action: ${action.type}`);
    }
  }

  getPartialScore(state) {
    const turns = state[S.turnsRemaining];
    return (
      state[S.score] +
      state[S.concentration] * (1 + Math.min(turns, 6) * 0.12) +
      state[S.goodConditionTurns] * (1 + Math.min(turns, 6) * 0.08) +
      state[S.goodImpressionTurns] * (1 + Math.min(turns, 6) * 0.15) +
      state[S.motivation] * (1 + Math.min(turns, 6) * 0.1) +
      state[S.genki] * 0.35 +
      state[S.stamina] * 0.05
    );
  }

  getActionsForSearch(state) {
    return this.getActions(state);
  }

  mergeNodes(nodes) {
    const merged = new Map();
    for (const node of nodes) {
      const key = `${node.firstActionKey}|${makeStateKey(node.state)}`;
      const previous = merged.get(key);
      if (!previous || this.getPartialScore(node.state) > this.getPartialScore(previous.state)) {
        merged.set(key, node);
      }
    }
    return [...merged.values()];
  }

  selectBeam(nodes) {
    const byFirstAction = new Map();
    for (const node of nodes) {
      const group = byFirstAction.get(node.firstActionKey) || [];
      group.push(node);
      byFirstAction.set(node.firstActionKey, group);
    }

    const selected = [];
    for (const group of byFirstAction.values()) {
      group.sort((a, b) => this.getPartialScore(b.state) - this.getPartialScore(a.state));
      selected.push(group[0]);
    }

    const remaining = nodes
      .filter((node) => !selected.includes(node))
      .sort((a, b) => this.getPartialScore(b.state) - this.getPartialScore(a.state));
    selected.push(...remaining);
    selected.sort((a, b) => this.getPartialScore(b.state) - this.getPartialScore(a.state));
    return selected.slice(0, this.options.beamWidth);
  }

  searchSample(initialState) {
    let beam = [{
      state: initialState,
      actions: [],
      firstActionKey: null,
    }];

    let expandedNodeCount = 0;
    for (let depth = 0; depth < this.options.maxDepth; depth++) {
      const expanded = [];
      for (const node of beam) {
        if (node.state[S.turnsRemaining] <= 0) {
          expanded.push(node);
          continue;
        }

        for (const action of this.getActionsForSearch(node.state)) {
          expandedNodeCount++;
          if (expandedNodeCount > this.options.maxSearchNodes) break;
          const nextState = this.applyAction(node.state, action);
          expanded.push({
            state: nextState,
            actions: node.actions.concat(action),
            firstActionKey: node.firstActionKey || actionKey(action),
          });
        }
        if (expandedNodeCount > this.options.maxSearchNodes) break;
      }

      const merged = this.mergeNodes(expanded);
      beam = this.selectBeam(merged);
      if (expandedNodeCount > this.options.maxSearchNodes) break;
      if (beam.every((node) => node.state[S.turnsRemaining] <= 0)) break;
    }

    return beam;
  }

  sampleInitialState(state) {
    const sampled = deepCopy(state);
    if (this.options.deckOrder === "unknown") {
      sampled[S.deckCards] = shuffleCopy(sampled[S.deckCards]);
    }
    return sampled;
  }

  evaluateCandidates(state) {
    const candidates = new Map();
    for (let sample = 0; sample < this.options.samples; sample++) {
      const leaves = this.searchSample(this.sampleInitialState(state));
      const bestByAction = new Map();

      for (const leaf of leaves) {
        if (!leaf.firstActionKey || leaf.actions.length === 0) continue;
        const score = leaf.state[S.score];
        const previous = bestByAction.get(leaf.firstActionKey);
        if (!previous || score > previous.score) {
          bestByAction.set(leaf.firstActionKey, {
            score,
            action: leaf.actions[0],
          });
        }
      }

      for (const [key, result] of bestByAction) {
        const candidate = candidates.get(key) || {
          action: result.action,
          scores: [],
        };
        candidate.scores.push(result.score);
        candidates.set(key, candidate);
      }
    }

    const targetScore = this.options.targetScore;
    return [...candidates.values()].map((candidate) => {
      const scores = candidate.scores;
      const passCount = targetScore == null
        ? 0
        : scores.filter((score) => score >= targetScore).length;
      return {
        ...candidate,
        passProbability: targetScore == null ? 0 : passCount / this.options.samples,
        p10Score: percentile(scores, 0.1),
        meanScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      };
    });
  }

  compareCandidates(a, b) {
    if (this.options.targetScore != null && a.passProbability !== b.passProbability) {
      return b.passProbability - a.passProbability;
    }
    if (a.p10Score !== b.p10Score) return b.p10Score - a.p10Score;
    return b.meanScore - a.meanScore;
  }

  evaluate(state) {
    const candidates = this.evaluateCandidates(state);
    if (candidates.length === 0) {
      return { end: true };
    }

    candidates.sort((a, b) => this.compareCandidates(a, b));
    this.lastRecommendation = candidates;
    const best = candidates[0];
    if (best.action.type === "card") return { card: best.action.card };
    if (best.action.type === "drink") return { drink: best.action.drinkIndex };
    return { end: true };
  }
}
