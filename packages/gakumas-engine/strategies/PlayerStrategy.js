export class CardSelectionRequest extends Error {
  constructor(type, state, cards, num, optional = false, isRawId = false) {
    super("Card selection required");
    this.type = type;
    this.state = state;
    this.cards = cards;
    this.num = num;
    this.optional = optional;
    this.isRawId = isRawId;
  }
}

export class PositionSelectionRequest extends Error {
  constructor(type, state, cards, reverse = true) {
    super("Position selection required");
    this.type = type;
    this.state = state;
    this.cards = cards;
    this.num = 1;
    this.optional = false;
    this.isRawId = false;
    this.reverse = reverse;
  }
}

export default class PlayerStrategy {
  constructor(engine) {
    this.engine = engine;
    this.pickCardsToHoldIndices = [];
  }

  evaluate(state) {
    throw new Error("evaluate is not implemented!");
  }

  pickCardsInternal(type, state, cards, num = 1, optional = false, isRawId = false) {
    if (this.pickCardsToHoldIndices.length > 0) {
      return this.pickCardsToHoldIndices.shift();
    } else {
      throw new CardSelectionRequest(type, state, cards, num, optional, isRawId);
    }
  }

  pickCardsToHold(state, cards, num = 1, optional = false) {
    return this.pickCardsInternal("HOLD_SELECTION", state, cards, num, optional);
  }

  pickCardsToMoveToHand(state, cards, num = 1, optional = false) {
    return this.pickCardsInternal("MOVE_TO_HAND_SELECTION", state, cards, num, optional);
  }

  pickCardsToMoveToTopOfDeck(state, cards, num = 1, optional = false) {
    return this.pickCardsInternal("MOVE_TO_TOP_OF_DECK_SELECTION", state, cards, num, optional);
  }

  pickCardsToUseFree(state, cards, num = 1) {
    return this.pickCardsInternal("USE_CARD_FREE_SELECTION", state, cards, num);
  }

  pickCardsToUse(state, cards, num = 1) {
    return this.pickCardsInternal("USE_CARD_SELECTION", state, cards, num);
  }

  pickCardsToCopy(state, cards, num = 1, optional = false) {
    return this.pickCardsInternal("COPY_SELECTION", state, cards, num, optional);
  }

  pickRandomCard(state, cards, isRawId = false) {
    return this.pickCardsInternal("RANDOM_SELECTION", state, cards, 1, false, isRawId)[0];
  }

  selectRandomInsertIndex(state, cards, reverse = true) {
    if (this.pickCardsToHoldIndices.length > 0) {
      return this.pickCardsToHoldIndices.shift()[0];
    } else {
      throw new PositionSelectionRequest("INSERT_POSITION_SELECTION", state, cards, reverse);
    }
  }

  pickCardsToGrow(state, cards, num = 1, optional = false) {
    return this.pickCardsInternal("GROW_SELECTION", state, cards, num, optional);
  }

}
