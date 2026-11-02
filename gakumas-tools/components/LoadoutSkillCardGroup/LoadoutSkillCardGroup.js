import { memo, useContext, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  FaArrowDown,
  FaArrowUp,
  FaChevronDown,
  FaEllipsis,
  FaFilm,
  FaImage,
  FaPlus,
  FaXmark,
  FaSort,
} from "react-icons/fa6";
import { SkillCards } from "gakumas-data";
import gkImg from "gakumas-images";
import Collapse from "@/components/Collapse";
import { RARITIES } from "gakumas-engine/constants";
import Image from "@/components/Image";
import MemoryPickerModal from "@/components/MemoryPickerModal";
import { compareMemorySkillCards } from "@/utils/sort";
import ModalLoading from "@/components/Modal/ModalLoading";
import StageSkillCards from "@/components/StageSkillCards";
import LoadoutContext from "@/contexts/LoadoutContext";
import ModalContext from "@/contexts/ModalContext";
import c from "@/utils/classNames";
import styles from "./LoadoutSkillCardGroup.module.scss";

const MemoryImporterModal = dynamic(
  () => import("@/components/MemoryImporterModal"),
  { ssr: false, loading: ModalLoading }
);

function LoadoutSkillCardGroup({
  skillCardIds,
  customizations,
  indications,
  groupIndex,
  groupCount,
  idolId,
  onInsert,
  onMove,
  onDelete,
}) {
  const t = useTranslations("LoadoutSkillCardGroup");
  const { status } = useSession();
  const {
    stage,
    setMemory,
    replaceSkillCardId,
    swapSkillCardIds,
    replaceCustomizations,
    setSkillCardIdGroups,
    setCustomizationGroups,
  } = useContext(LoadoutContext);
  const { setModal, closeModal } = useContext(ModalContext);
  const [expanded, setExpanded] = useState(false);
  const [costExpanded, setCostExpanded] = useState(false);

  const costBreakdown = useMemo(
    () =>
      skillCardIds
        .filter((id) => id)
        .map((id) => {
          const card = SkillCards.getById(id);
          return {
            id,
            name: card.name,
            cost: card.sourceType == "pIdol" ? 0 : card.contestPower,
            card,
          };
        }),
    [skillCardIds],
  );
  const rarityBreakdown = useMemo(
    () =>
      skillCardIds
        .filter((id) => id)
        .reduce((acc, cur) => {
          const card = SkillCards.getById(cur);
          if (!acc[card.rarity]) {
            acc[card.rarity] = 1
          } else {
            acc[card.rarity] += 1;
          }
          return acc;
        }, {}),
    [skillCardIds],
  );

  const cost = useMemo(
    () => costBreakdown.reduce((acc, cur) => acc + cur.cost, 0),
    [costBreakdown],
  );
  const cardCount = useMemo(
    () => skillCardIds.filter((id) => id !== 0).length,
    [skillCardIds]
  );
  const isExam = stage.type === "exam";

  const actions = [
    {
      key: "sort",
      icon: FaSort,
      onClick: () => {
        const skillAndCustomizations = skillCardIds.map(
          (id, i) => ({
            card: SkillCards.getById(id),
            skillCardId: id,
            customizations: customizations?.[i],
          }),
        );
        skillAndCustomizations.sort((a, b) => {
          if (!a.card) return 1;
          if (!b.card) return -1;
          return compareMemorySkillCards(a.card, b.card);
        });
        setSkillCardIdGroups((groups) => {
          const newGroups = [...groups];
          newGroups[groupIndex] = skillAndCustomizations.map(
            (sc) => sc.skillCardId
          );
          return newGroups;
        });
        setCustomizationGroups((groups) => {
          const newGroups = [...groups];
          newGroups[groupIndex] = skillAndCustomizations.map(
            (sc) => sc.customizations
          );
          return newGroups;
        });
      },
    },
    !isExam && [
      status == "authenticated" && {
        key: "memories",
        icon: FaFilm,
        onClick: () => setModal(<MemoryPickerModal index={groupIndex} />),
      },
      {
        key: "importMemory",
        icon: FaImage,
        onClick: () =>
          setModal(
            <MemoryImporterModal
              multiple={false}
              onSuccess={(memories) => {
                setMemory(memories[0], groupIndex);
                closeModal();
              }}
            />,
          ),
      },
      {
        key: "addRow",
        icon: FaPlus,
        onClick: () => onInsert(groupIndex + 1),
      },
      {
        key: "moveUp",
        icon: FaArrowUp,
        onClick: () => onMove(groupIndex, groupIndex - 1),
        disabled: groupIndex < 1,
      },
      {
        key: "moveDown",
        icon: FaArrowDown,
        onClick: () => onMove(groupIndex, groupIndex + 1),
        disabled: groupIndex >= groupCount - 1,
      },
      {
        key: "removeRow",
        icon: FaXmark,
        onClick: () => onDelete(groupIndex),
        disabled: groupCount < 2,
        danger: true,
      },
    ],
  ].flat().filter(Boolean);

  return (
    <div>
      <StageSkillCards
        skillCardIds={skillCardIds}
        customizations={customizations}
        replaceSkillCardId={replaceSkillCardId}
        swapSkillCardIds={swapSkillCardIds}
        replaceCustomizations={replaceCustomizations}
        indications={indications}
        idolId={idolId}
        groupIndex={groupIndex}
        stage={stage}
      />

      <div className={styles.sub}>
        <div className={styles.costWrapper}>
          <button
            type="button"
            className={c(styles.chip, costExpanded && styles.selected)}
            onClick={() => setCostExpanded((v) => !v)}
            aria-expanded={costExpanded}
          >
            {isExam ? t("cardCount") : t("cost")}: {isExam ? cardCount : cost}
            <FaChevronDown className={styles.caret} aria-hidden="true" />
          </button>
        </div>
        <div
          className={c(styles.actions, expanded && styles.expanded)}
          onClick={() => setExpanded(false)}
          data-export-hide="true"
        >
          {actions.map(({ key, icon: Icon, onClick, disabled, danger }, i) => (
            <button
              key={key}
              type="button"
              className={c(
                styles.chip,
                styles.action,
                danger && styles.danger,
              )}
              style={{ "--i": i }}
              onClick={onClick}
              disabled={disabled}
              title={t(key)}
              aria-label={t(key)}
            >
              <Icon aria-hidden="true" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className={c(styles.chip, styles.more, expanded && styles.selected)}
          onClick={(e) => {
            setExpanded(!expanded);
            e.stopPropagation();
          }}
          aria-expanded={expanded}
          data-export-hide="true"
        >
          <FaEllipsis aria-hidden="true" />
        </button>
      </div>

      <Collapse open={costExpanded} className={styles.costCollapse}>
        {isExam ? (
          <ul className={styles.costBreakdown} data-export-hide="true">
            {RARITIES.map((rarity) => (
              <li key={rarity}>
                <span className={styles.breakdownName}>{rarity}</span>
                <span className={styles.breakdownCost}>{rarityBreakdown[rarity] || 0}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className={styles.costBreakdown} data-export-hide="true">
            {costBreakdown.map((item, i) => (
              <li key={`${i}_${item.id}`} style={{ "--i": i }}>
                <Image
                  src={gkImg(item.card, idolId).icon}
                  width={20}
                  height={20}
                  alt=""
                />
                <span className={styles.breakdownName}>{item.name}</span>
                <span className={styles.breakdownCost}>{item.cost}</span>
              </li>
            ))}
          </ul>
        )}
      </Collapse>
    </div>
  );
}

export default memo(LoadoutSkillCardGroup);
