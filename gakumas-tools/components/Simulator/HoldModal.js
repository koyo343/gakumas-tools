import { useState } from "react";
import { useTranslations } from "next-intl";
import { SkillCards, PDrinks, PItems } from "gakumas-data";
import { S } from "gakumas-engine";
import gkImg from "gakumas-images";
import Image from "@/components/Image";
import Button from "@/components/Button";
import EntityIcon from "@/components/EntityIcon";
import Modal from "@/components/Modal";
import c from "@/utils/classNames";
import { EntityTypes } from "@/utils/entities";
import styles from "./ManualPlay.module.scss";

export default function HoldModal({ decision, onDecision, idolId }) {
  const t = useTranslations("stage");
  const { state, cards, num, optional = false, isRawId = false } = decision;
  const [selectedIndices, setSelectedIndices] = useState([]);

  let resolvedEntity = null;
  if (state[S.phase] == "processCard") {
    resolvedEntity = SkillCards.getById(state[S.cardMap][state[S.usedCard]].id);
  } else if (state[S.phase] == "processDrink") {
    resolvedEntity = PDrinks.getById(state[S.usedDrink]);
  } else if (["skillCard", "skillCardEffect", "hifAbility"]
      .includes(state[S.triggeredEffect]?.source?.type)) {
    resolvedEntity = SkillCards.getById(state[S.triggeredEffect].source?.id);
  } else if (["pItem", "pItemEffect"].includes(state[S.triggeredEffect]?.source?.type)) {
    resolvedEntity = PItems.getById(state[S.triggeredEffect].source?.id);
  } else if (["pDrink", "pDrinkEffect"].includes(state[S.triggeredEffect]?.source?.type)) {
    resolvedEntity = PDrinks.getById(state[S.triggeredEffect].source?.id);
  }
  const { icon } = gkImg(resolvedEntity, idolId);

  const promptKey =
    {
      HOLD_SELECTION: "selectCardsToHold",
      MOVE_TO_HAND_SELECTION: "selectCardsToMoveToHand",
      MOVE_TO_TOP_OF_DECK_SELECTION: "selectCardsToMoveToTopOfDeck",
      USE_CARD_FREE_SELECTION: "selectCardsToUseFree",
      USE_CARD_SELECTION: "selectCardsToUse",
      COPY_SELECTION: "selectCardsToCopy",
      RANDOM_SELECTION: "selectRandomCards",
      GROW_SELECTION: "selectCardsToGrow",
    }[decision.type] ?? "selectCardsToMoveToHand";

  const toggleCard = (arrayIndex) => {
    setSelectedIndices((prev) => {
      if (prev.includes(arrayIndex)) {
        return prev.filter((i) => i !== arrayIndex);
      } else if (prev.length < num) {
        return [...prev, arrayIndex];
      }
      return prev;
    });
  };

  return (
    <Modal dismissable={false}>
      {state[S.phase] == "processCard" && (
        <div className={styles.entity}>
          <Image src={icon} width={24} height={24} alt="" />
          {t("skillCard")}「{resolvedEntity.name}」
        </div>
      )}
      {state[S.phase] == "processDrink" && (
        <div className={styles.entity}>
          <Image src={icon} width={24} height={24} alt="" />
          {t("pDrink")}「{resolvedEntity.name}」
        </div>
      )}
      {state[S.phase] != "processCard" && state[S.phase] != "processDrink" && (
        <div className={styles.entity}>
          {resolvedEntity && <Image src={icon} width={24} height={24} alt="" />}
          {t("effect")}{resolvedEntity ? `「${resolvedEntity.name}」` : ""}
        </div>
      )}
      <h3>
        {t(promptKey, { num })}
      </h3>
      <div className={styles.cardGrid}>
        {cards.map((cardIndex, arrayIndex) => {
          const card = isRawId ? { id: cardIndex } : state[S.cardMap][cardIndex];
          const isSelected = selectedIndices.includes(arrayIndex);
          return (
            <button
              key={arrayIndex}
              className={c(styles.holdCard, isSelected && styles.selected)}
              onClick={() => toggleCard(arrayIndex)}
            >
              <div className={styles.imgWrapper}>
                <EntityIcon
                  type={EntityTypes.SKILL_CARD}
                  id={card.id}
                  customizations={card.c11n}
                  idolId={idolId}
                  size="fill"
                />
              </div>
              {SkillCards.getById(card.id).name}
            </button>
          );
        })}
      </div>
      <Button
        style="blue"
        fill
        onClick={() => onDecision(selectedIndices)}
        disabled={!optional && selectedIndices.length < num}
      >
        {t("confirm")} ({selectedIndices.length}/{num})
      </Button>
    </Modal>
  );
}
