import { G, GROWTH_FIELDS, S } from "../constants";
import { deepCopy, getRand } from "../utils";
import BaseStrategy from "./BaseStrategy";

const DEFAULT_MAX_DEPTH = 3;

// Shared "sum amount × (turns || turnsRemaining)" for the buff-weighting
// used across getStateScore. A tight for-loop is notably faster than
// `Array.reduce` with an arrow closure in hot paths (dozens of calls per
// getStateScore, called thousands of times per run).
function sumBuffWeight(buffs, turnsRemaining) {
  let total = 0;
  for (let i = 0; i < buffs.length; i++) {
    const b = buffs[i];
    total += b.amount * (b.turns || turnsRemaining);
  }
  return total;
}

const GROWTH_SCORE_MULTIPLIER_BY_INDEX = [];

const GROWTH_SCORE_MULTIPLIERS = {
  [G["g.score"]]: 2,
  [G["g.scoreTimes"]]: 20,
  [G["g.cost"]]: 1,
  [G["g.typedCost"]]: 1,
  [G["g.genki"]]: 1,
  [G["g.goodConditionTurns"]]: 1,
  [G["g.perfectConditionTurns"]]: 1,
  [G["g.concentration"]]: 2,
  [G["g.goodImpressionTurns"]]: 1,
  [G["g.motivation"]]: 1,
  [G["g.fullPowerCharge"]]: 1,
  [G["g.halfCostTurns"]]: 1,
  [G["g.scoreByGoodImpressionTurns"]]: 20,
  [G["g.scoreByMotivation"]]: 20,
  [G["g.scoreByGenki"]]: 20,
  [G["g.stanceLevel"]]: 2,
};
for (let k = 0; k < GROWTH_FIELDS.length; k++) {
  GROWTH_SCORE_MULTIPLIER_BY_INDEX[k] = GROWTH_SCORE_MULTIPLIERS[k] || 1;
}

export default class HeuristicStrategy extends BaseStrategy {
  constructor(engine) {
    super(engine);

    this.depth = 0;
    this.rootEffectCount = 0;
    // Per-linkPhase cache of config-derived scoring constants so
    // getStateScore doesn't rebuild them on every call (it fires several
    // times per useCard speculation, thousands of times per run).
    this._configCache = new Map();

    if (engine.config.simulator.enableStrategyCustomizations) {
      this.maxDepth = engine.config.simulator.maxDepth;
      this.nextDepth = engine.config.simulator.nextDepth;

      this.customScoreMultiplier = engine.config.simulator.scoreMultiplier;
      this.customGoodConditionTurnsMultiplier = engine.config.simulator.goodConditionTurnsMultiplier;
      this.customConcentrationMultiplier = engine.config.simulator.concentrationMultiplier;
      this.customGoodImpressionTurnsMultiplier = engine.config.simulator.goodImpressionTurnsMultiplier;
      this.customMotivationMultiplier = engine.config.simulator.motivationMultiplier;
      this.customFullPowerMultiplier = engine.config.simulator.fullPowerMultiplier;

      this.enableEffectScore = engine.config.simulator.enableEffectScore;
      this.effectScoreMultiplier = engine.config.simulator.effectScoreMultiplier;
      this.fixScoreBonusOnHolding = engine.config.simulator.fixScoreBonusOnHolding;
    } else {
      this.maxDepth = DEFAULT_MAX_DEPTH;
      this.nextDepth = DEFAULT_MAX_DEPTH;

      this.customScoreMultiplier = 1;
      this.customGoodConditionTurnsMultiplier = 1;
      this.customConcentrationMultiplier = 1;
      this.customGoodImpressionTurnsMultiplier = 1;
      this.customMotivationMultiplier = 1;
      this.customFullPowerMultiplier = 1;

      this.enableEffectScore = false;
      this.effectScoreMultiplier = 1;
      this.fixScoreBonusOnHolding = false;
    }
  }

  _getScoringConfig(state) {
    const linkPhase = state[S.linkPhase] || 0;
    let cache = this._configCache.get(linkPhase);
    if (cache) return cache;

    const config = this.engine.getConfig(state);
    const { recommendedEffect, pIdolId, plan } = config.idol;

    let goodConditionTurnsMultiplier =
      recommendedEffect == "goodConditionTurns" ? 1.75 : 1;
    if (pIdolId == 114) goodConditionTurnsMultiplier = 8;
    goodConditionTurnsMultiplier *= this.customGoodConditionTurnsMultiplier;

    let concentrationMultiplier = recommendedEffect == "concentration" ? 3 : 1;
    concentrationMultiplier *= this.customConcentrationMultiplier;

    let goodImpressionTurnsMultiplier =
      recommendedEffect == "goodImpressionTurns" ? 3.5 : 1;
    goodImpressionTurnsMultiplier *= this.customGoodImpressionTurnsMultiplier;

    let motivationMultiplier = recommendedEffect == "motivation" ? 5.5 : 1;
    motivationMultiplier *= this.customMotivationMultiplier;

    let fullPowerMultiplier = recommendedEffect == "fullPower" ? 5 : 1;
    fullPowerMultiplier *= this.customFullPowerMultiplier;

    // Average type multiplier: weighted by each turn type's share of the
    // stage's turn count. Pure function of config.
    const { typeMultipliers, stage } = config;
    let averageTypeMultiplier = 0;
    for (const type in typeMultipliers) {
      averageTypeMultiplier +=
        (typeMultipliers[type] * stage.turnCounts[type]) / stage.turnCount;
    }

    cache = {
      config,
      recommendedEffect,
      pIdolId,
      plan,
      goodConditionTurnsMultiplier,
      concentrationMultiplier,
      goodImpressionTurnsMultiplier,
      motivationMultiplier,
      fullPowerMultiplier,
      averageTypeMultiplier,
    };
    this._configCache.set(linkPhase, cache);
    return cache;
  }

  evaluate(state) {
    const result = this.evaluateInternal(state, state);
    return { score: result.score, state: result.nextState };
  }

  evaluateInternal(state, nextState) {
    if (this.depth == 0) {
      this.rootEffectCount = state[S.effects].length;
      state[S.usedCardIds] = [];
      if (state[S.cardPriorities]) {
        const endTurnState = this.engine.endTurn(state);
        this.rootScore = this.getStateScore(endTurnState);
      }
    }

    let handLog = null;
    if (this.depth < this.nextDepth) {
      handLog = this.engine.logger.log(state, "hand", null);
    }

    const futures = state[S.handCards].map((card) =>
      this.getFuture(state, nextState, card)
    );

    const scores = futures.map((f) => (f ? f.score : -Infinity));
    let maxScore = Math.max(...scores);
    let selectedIndex = null;
    if (maxScore > 0) {
      selectedIndex = scores.indexOf(maxScore);
      if (this.depth < this.nextDepth) {
        nextState = futures[selectedIndex].nextState;
      }
    } else {
      const endTurnState = this.engine.endTurn(state);
      if (this.depth < this.nextDepth) {
        nextState = endTurnState;
      }
      maxScore = this.getStateScore(endTurnState);
    }

    if (handLog !== null) {
      handLog.data = {
        handCards: state[S.handCards].map((card) => ({
          id: state[S.cardMap][card].id,
          c: state[S.cardMap][card].c11n,
        })),
        scores,
        selectedIndex,
        state: this.engine.logger.getHandStateForLogging(state),
      };
    }

    return { score: maxScore, state: nextState, nextState: nextState };
  }

  getFuture(state, nextState, card) {
    if (!this.engine.isCardUsable(state, card)) {
      return null;
    }

    const previewState = this.engine.useCard(state, card);
    if (this.depth < this.nextDepth) {
      nextState = previewState;
    }
    previewState[S.usedCardIds].push(card);
    this.depth++;

    // Additional actions
    if (
      previewState[S.turnsRemaining] >= state[S.turnsRemaining] &&
      this.depth < this.maxDepth
    ) {
      const future = this.evaluateInternal(previewState, nextState);
      this.depth--;
      return { score: future.score, state: future.state, nextState: future.nextState };
    }

    let score = 0;
    const previewScore = this.getStateScore(previewState);

    // Effects -- TODO: make this not suck
    const effectsDiff = previewState[S.effects].length - this.rootEffectCount;
    for (let i = 0; i < effectsDiff; i++) {
      const effect =
        previewState[S.effects][previewState[S.effects].length - i - 1];
      let limit = previewState[S.turnsRemaining];
      if (
        effect.limit != null &&
        effect.limit < previewState[S.turnsRemaining]
      ) {
        limit = effect.limit + 1;
      }
      if (limit == 0) continue;
      const postEffectState = deepCopy(previewState);
      this.engine.effectManager.triggerEffects(
        postEffectState,
        [
          {
            ...effect,
            phase: null,
            delay: effect.delay - previewState[S.turnsRemaining],
          },
        ],
        null,
        null,
        true
      );
      const scoreDelta = this.getStateScore(postEffectState) - previewScore;
      score += 3 * scoreDelta * Math.min(limit, 6);
    }

    if (this.engine.getConfig(state).idol.plan != "anomaly") {
      // Cards removed
      score +=
        (((state[S.removedCards].length - previewState[S.removedCards].length) *
          (previewState[S.score] - state[S.score])) /
          this.getAverageTypeMultiplier(state)) *
        Math.floor(previewState[S.turnsRemaining] / 13);
    }

    score += previewScore;

    if (previewState[S.cardPriorities]) {
      let scoreDelta = score - this.rootScore;
      for (const cardId of previewState[S.usedCardIds]) {
        const priority = previewState[S.cardPriorities][cardId];
        if (priority != null) {
          scoreDelta *= priority;
        }
      }
      score = this.rootScore + scoreDelta;
    }
    this.depth--;
    return { score: Math.round(score), state: previewState, nextState: nextState };
  }

  getAverageTypeMultiplier(state) {
    return this._getScoringConfig(state).averageTypeMultiplier;
  }

  scaleScore(score, state) {
    return Math.ceil(score * this.getAverageTypeMultiplier(state));
  }

  getStateScore(state) {
    const sc = this._getScoringConfig(state);
    // Mirror multipliers on `this` so call-sites that read them (including
    // `getFuture`'s scoring adjustments) keep working unchanged.
    this.goodConditionTurnsMultiplier = sc.goodConditionTurnsMultiplier;
    this.concentrationMultiplier = sc.concentrationMultiplier;
    this.goodImpressionTurnsMultiplier = sc.goodImpressionTurnsMultiplier;
    this.motivationMultiplier = sc.motivationMultiplier;
    this.fullPowerMultiplier = sc.fullPowerMultiplier;

    const turnsRemaining = state[S.turnsRemaining];
    const goodConditionTurns = state[S.goodConditionTurns];

    // Calc score

    let score = 0;

    // Cards in hand
    score += state[S.handCards].length * 3;

    // Cards used
    score += state[S.cardsUsed] * 8;

    // Stamina
    score += state[S.stamina] * turnsRemaining * 0.05;

    // Genki
    score +=
      state[S.genki] *
      Math.tanh(turnsRemaining / 3) *
      0.7 *
      sc.motivationMultiplier;

    // Good condition turns
    if (sc.pIdolId == 114) {
      if (turnsRemaining > 0) {
        score += goodConditionTurns * 3 * sc.goodConditionTurnsMultiplier;
      }
    } else {
      score +=
        Math.min(goodConditionTurns, turnsRemaining) *
        1.6 *
        sc.goodConditionTurnsMultiplier;
    }

    // Perfect condition turns
    score +=
      Math.min(state[S.perfectConditionTurns], turnsRemaining) *
      goodConditionTurns *
      sc.goodConditionTurnsMultiplier *
      1.5;

    // Concentration
    score +=
      state[S.concentration] * turnsRemaining * sc.concentrationMultiplier;

    // Stance
    if (
      sc.plan == "anomaly" &&
      (turnsRemaining || state[S.cardUsesRemaining])
    ) {
      score += state[S.strengthTimes] * 40;
      score += state[S.preservationTimes] * 80;
      score += state[S.leisureTimes] * 80;
      score += state[S.fullPowerTimes] * 80 * sc.fullPowerMultiplier;

      //Enthusiasm
      // score += state[S.enthusiasm] * 5;
      score += sumBuffWeight(state[S.enthusiasms], turnsRemaining) * 5;

      // Full power charge
      score +=
        state[S.cumulativeFullPowerCharge] * 3 * sc.fullPowerMultiplier;

      // Enthusiasm buffs
      score += sumBuffWeight(state[S.enthusiasmBuffs], turnsRemaining) * 5;

      // Full power charge buffs
      score +=
        sumBuffWeight(state[S.fullPowerChargeBuffs], turnsRemaining) *
        sc.fullPowerMultiplier;

      // Full power effect buffs
      score +=
        sumBuffWeight(state[S.fullPowerEffectBuffs], turnsRemaining) *
        sc.fullPowerMultiplier;

      // Strength effect buffs
      score += sumBuffWeight(state[S.strengthEffectBuffs], turnsRemaining);

      // Growth
      score += this.getGrowthScore(state) * 0.2 * turnsRemaining;
    }

    // Good impression turns
    score +=
      state[S.goodImpressionTurns] *
      turnsRemaining *
      sc.goodImpressionTurnsMultiplier;

    // Motivation
    score +=
      state[S.motivation] * turnsRemaining * 0.45 * sc.motivationMultiplier;

    // Pride turns
    score += state[S.prideTurns] * turnsRemaining * 0.2;

    // Score buffs
    score += sumBuffWeight(state[S.scoreBuffs], turnsRemaining) * 8;

    // Half cost turns
    score += Math.min(state[S.halfCostTurns], turnsRemaining) * 6;

    // Double cost turns
    score += Math.min(state[S.doubleCostTurns], turnsRemaining) * -6;

    // Double buff cost turns
    score += Math.min(state[S.doubleBuffCostTurns], turnsRemaining) * -6;

    // Cost reduction
    score += state[S.costReduction] * turnsRemaining * 0.5;

    // Double card effect cards
    score += state[S.doubleCardEffectCards] * 50;

    // Card uses remaining
    score += state[S.cardUsesRemaining] * 50;

    // Good impression turns buffs
    score +=
      sumBuffWeight(state[S.goodImpressionTurnsBuffs], turnsRemaining) *
      10 *
      sc.goodImpressionTurnsMultiplier;

    // Good impression turns effects buffs
    score +=
      sumBuffWeight(state[S.goodImpressionTurnsEffectBuffs], turnsRemaining) *
      state[S.goodImpressionTurns] *
      sc.goodImpressionTurnsMultiplier;

    // Good impression turns times buffs
    score +=
      sumBuffWeight(state[S.goodImpressionTurnsTimesBuffs], turnsRemaining) *
      state[S.goodImpressionTurns] *
      sc.goodImpressionTurnsMultiplier;

    // Good condition turns buffs
    score +=
      sumBuffWeight(state[S.goodConditionTurnsBuffs], turnsRemaining) *
      sc.goodConditionTurnsMultiplier;

    // Good condition turns addition buffs
    score +=
      sumBuffWeight(state[S.goodConditionTurnsAdditionBuffs], turnsRemaining) *
      sc.goodConditionTurnsMultiplier;

    // Motivation buffs
    score +=
      sumBuffWeight(state[S.motivationBuffs], turnsRemaining) *
      sc.motivationMultiplier;

    // Motivation addition buffs
    score +=
      sumBuffWeight(state[S.motivationAdditionBuffs], turnsRemaining) *
      sc.motivationMultiplier;

    // Concentration buffs
    score +=
      sumBuffWeight(state[S.concentrationBuffs], turnsRemaining) *
      sc.concentrationMultiplier;

    // Concentration addition buffs
    score +=
      sumBuffWeight(state[S.concentrationAdditionBuffs], turnsRemaining) *
      sc.concentrationMultiplier;

    // Concentration effect buffs
    score +=
      sumBuffWeight(state[S.concentrationEffectBuffs], turnsRemaining) * 
      sc.concentrationMultiplier;

    // Nullify genki turns
    score += state[S.nullifyGenkiTurns] * -9;

    // Turn cards upgraded
    score += state[S.turnCardsUpgraded] * 20;

    // Effect score
    if (this.enableEffectScore) {
      score += this.getEffectScore(state) * this.effectScoreMultiplier;
    }

    // Scale score
    score = Math.ceil(score * sc.averageTypeMultiplier);

    const baseScore = state[S.score] * this.customScoreMultiplier;
    const recommendedEffect = sc.recommendedEffect;
    if (recommendedEffect == "goodConditionTurns") {
      score += baseScore * 0.4;
    } else if (recommendedEffect == "concentration") {
      score += baseScore * 0.6;
    } else if (recommendedEffect == "goodImpressionTurns") {
      score += baseScore * 1.1;
    } else if (recommendedEffect == "motivation") {
      score += baseScore * 0.6;
    } else if (recommendedEffect == "strength") {
      score += baseScore * 0.65;
    } else if (recommendedEffect == "preservation") {
      score += baseScore * 0.65;
    } else if (recommendedEffect == "fullPower") {
      score += baseScore * 0.8;
    } else {
      score += baseScore;
    }

    return Math.round(score);
  }

  getGrowthScore(state) {
    let growthScore = 0;
    const cardMap = state[S.cardMap];
    for (let i = 0; i < cardMap.length; i++) {
      const growth = cardMap[i].growth;
      if (!growth) continue;
      for (let k = 0; k < GROWTH_FIELDS.length; k++) {
        const value = growth[k];
        if (value !== undefined) {
          growthScore += value * GROWTH_SCORE_MULTIPLIER_BY_INDEX[k];
        }
      }
    }
    return growthScore;
  }

  getEffectScore(state) {
    let score = 0;
    const effectState = deepCopy(state);
    effectState[S.stance] = "none";
    const effects = effectState[S.effects].filter(
      (e) => e.actions && e.actions.some(a => a.type === "assignment" && a.lhs === "score")
    );
    let preEffectScore = effectState[S.score];
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      let limit = effectState[S.turnsRemaining];
      if (
        effect.limit != null &&
        effect.limit < limit
      ) {
        limit = effect.limit;
      }
      if (limit <= 0) continue;
      this.engine.effectManager.triggerEffects(
        effectState,
        [
          {
            ...effect,
            phase: null,
            delay: effect.delay - effectState[S.turnsRemaining],
          },
        ],
        null,
        null,
        true
      );
      const effectScore = (effectState[S.score] - preEffectScore) * limit;
      score += effectScore / this.engine.turnManager.getTurnMultiplier(effectState);
      preEffectScore = effectState[S.score];
    }
    return score;
  }

  evaluateForHold(state, card) {
    let previewState = this.engine.getInitialState(true);
    previewState[S.cardMap] = state[S.cardMap].slice();
    previewState[S.nullifySelect] = 1;
    this.engine.buffManager.setStance(previewState, "fullPower");
    if (this.fixScoreBonusOnHolding) {
      const getTurnMultiplierBackup = this.engine.turnManager.getTurnMultiplier;
      this.engine.turnManager.getTurnMultiplier = () => 10;
      previewState = this.engine.useCard(previewState, card);
      this.engine.turnManager.getTurnMultiplier = getTurnMultiplierBackup;
      return Math.round(previewState[S.score]);
    } else {
      previewState = this.engine.useCard(previewState, card);
      return Math.round(previewState[S.score]);
    }
  }

  pickCardsToHold(state, cards, num = 1, optional = false) {
    // When optional, compare candidates against currently-held cards —
    // only hold a candidate if it beats one of the top-2 held slots.
    const evalCards = optional ? cards.concat(state[S.heldCards]) : cards;
    const scores = evalCards.map((c) => this.evaluateForHold(state, c));
    return scores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((item) => item.index)
      .filter((index) => index < cards.length)
      .slice(0, num);
  }

  pickCardsToMoveToHand(state, cards, num = 1, optional = false) {
    return this.pickCardsToHold(state, cards, num, optional);
  }

  pickCardsToMoveToTopOfDeck(state, cards, num = 1, optional = false) {
    return this.pickCardsToHold(state, cards, num, optional);
  }

  pickCardsToUseFree(state, cards, num = 1) {
    return this.pickCardsToHold(state, cards, num);
  }

  pickCardsToUse(state, cards, num = 1) {
    return this.pickCardsToHold(state, cards, num);
  }

  pickCardsToCopy(state, cards, num = 1, optional = false) {
    return this.pickCardsToHold(state, cards, num, optional);
  }

  pickRandomCard(state, cards, isRawId = false) {
    return Math.floor(getRand(state) * cards.length);
  }

  selectRandomInsertIndex(state, cards) {
    return Math.floor(getRand(state) * (cards.length + 1));
  }

  pickCardsToGrow(state, cards, num = 1, optional = false) {
    return this.pickCardsToHold(state, cards, num, optional);
  }

}
