"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { STARTING_EFFECTS } from "gakumas-engine/constants";
import { Stages, StrategyCustomizations } from "gakumas-data";
import { usePathname } from "@/i18n/routing";
import LoadoutUrlContext from "@/contexts/LoadoutUrlContext";
import WorkspaceContext from "@/contexts/WorkspaceContext";
import {
  getDefaultParams,
  getSimulatorUrl,
  getStage,
  knownStageId,
} from "@/utils/simulator";
import { setMemorySlot } from "@/utils/memorySlots";
import { fixCustomizations } from "@/utils/customizations";
import { DEFAULTS } from "@/utils/simulator";
import { deserializeIds } from "@/utils/ids";
import { inferPIdolId, getExamStage } from "@/utils/exams";
import { getIdolRoadStage } from "@/utils/idolRoad";

const LoadoutContext = createContext();

export const LoadoutActionsContext = createContext();

export function LoadoutContextProvider({ children }) {
  const pathname = usePathname();
  const { loadoutFromUrl, loadoutsFromUrl, updateUrl } =
    useContext(LoadoutUrlContext);
  const { setPlan } = useContext(WorkspaceContext);

  const initialLoadout = loadoutsFromUrl[0] || loadoutFromUrl;

  const [memorySlots, setMemorySlots] = useState([null, null]);
  const [stageId, setStageId] = useState(initialLoadout.stageId);
  const [customStage, setCustomStage] = useState(null);
  const [supportBonus, setSupportBonus] = useState(initialLoadout.supportBonus);
  const [params, setParams] = useState(initialLoadout.params);
  const [pItemIds, setPItemIds] = useState(initialLoadout.pItemIds);
  const [skillCardIdGroups, setSkillCardIdGroups] = useState(
    initialLoadout.skillCardIdGroups
  );
  const [customizationGroups, setCustomizationGroups] = useState(
    initialLoadout.customizationGroups
  );
  const [pDrinkIds, setPDrinkIds] = useState(initialLoadout.pDrinkIds);
  const [hifAbilityIds, setHifAbilityIds] = useState(initialLoadout.hifAbilityIds);
  const [startingEffects, setStartingEffects] = useState(
    initialLoadout.startingEffects
  );

  const [enableSkillCardOrder, setEnableSkillCardOrder] = useState(
    initialLoadout.enableSkillCardOrder
  );
  const [skillCardIdOrderGroups, setSkillCardIdOrderGroups] = useState(
    initialLoadout.skillCardIdOrderGroups
  );
  const [customizationOrderGroups, setCustomizationOrderGroups] = useState(
    initialLoadout.customizationOrderGroups
  );
  const [removedCardOrder, setRemovedCardOrder] = useState(initialLoadout.removedCardOrder);
  const [turnTypeOrder, setTurnTypeOrder] = useState(initialLoadout.turnTypeOrder);

  const [enableStrategyCustomizations, setEnableStrategyCustomizations] = useState(
    initialLoadout.enableStrategyCustomizations || false
  );
  const [strategyCustomizations, setStrategyCustomizations] = useState(
    initialLoadout.strategyCustomizations || {}
  );
  const [enableCardPriorities, setEnableCardPriorities] = useState(
    initialLoadout.enableCardPriorities || false
  );
  const [prioritySkillCardIds, setPrioritySkillCardIds] = useState(
    initialLoadout.prioritySkillCardIds || [0]
  );
  const [priorityCustomizations, setPriorityCustomizations] = useState(
    initialLoadout.priorityCustomizations || [{}]
  );
  const [priorityValues, setPriorityValues] = useState(
    initialLoadout.priorityValues || ["100"]
  );

  const pIdolId = inferPIdolId(pItemIds, skillCardIdGroups);

  const stage = useMemo(() => {
    let stage = getStage(stageId, customStage);
    if (stage.type == "exam") {
      stage = getExamStage(stageId, pIdolId);
    } else if (stage.type === "idolRoad") {
      stage = getIdolRoadStage(stageId, pIdolId);
    }
    return stage;
  }, [stageId, customStage, pIdolId]);

  const loadout = useMemo(
    () => ({
      stageId,
      customStage: stageId == "custom" ? customStage : {},
      supportBonus,
      params,
      pItemIds,
      skillCardIdGroups,
      customizationGroups,
      pDrinkIds,
      hifAbilityIds,
      startingEffects,
      enableSkillCardOrder,
      skillCardIdOrderGroups,
      customizationOrderGroups,
      removedCardOrder,
      turnTypeOrder,
      enableStrategyCustomizations,
      strategyCustomizations,
      enableCardPriorities,
      prioritySkillCardIds,
      priorityCustomizations,
      priorityValues,
    }),
    [
      stageId,
      customStage,
      supportBonus,
      params,
      pItemIds,
      skillCardIdGroups,
      customizationGroups,
      pDrinkIds,
      hifAbilityIds,
      startingEffects,
      enableSkillCardOrder,
      skillCardIdOrderGroups,
      customizationOrderGroups,
      removedCardOrder,
      turnTypeOrder,
      enableStrategyCustomizations,
      strategyCustomizations,
      enableCardPriorities,
      prioritySkillCardIds,
      priorityCustomizations,
      priorityValues,
    ]
  );

  const [currentLoadoutIndex, setCurrentLoadoutIndex] = useState(0);
  const [loadouts, setLoadouts] = useState(
    loadoutsFromUrl.length ? loadoutsFromUrl : [loadout]
  );

  const simulatorUrl = useMemo(
    () => getSimulatorUrl(loadout, loadouts, pathname),
    [loadout, loadouts, pathname]
  );

  const setLoadout = useCallback((loadout) => {
    setStageId(knownStageId(loadout.stageId));
    if (loadout.stageId == "custom") {
      let custom = loadout.customStage;
      if (Array.isArray(custom.firstTurns)) {
        const length = custom.firstTurns.length;
        custom.firstTurns = custom.firstTurns.reduce((acc, cur) => {
          acc[cur] = 1 / length;
          return acc;
        }, {});
      }
      setCustomStage(custom);
    }
    setSupportBonus(loadout.supportBonus);
    setMemorySlots([null, null]);
    setParams(loadout.params);
    setPItemIds(loadout.pItemIds);
    setPDrinkIds(loadout.pDrinkIds || deserializeIds(DEFAULTS.pDrinkIds));
    setHifAbilityIds(loadout.hifAbilityIds || deserializeIds(DEFAULTS.hifAbilityIds));
    setStartingEffects(loadout.startingEffects || deserializeIds(DEFAULTS.startingEffects));
    setSkillCardIdGroups(loadout.skillCardIdGroups);
    if (loadout.customizationGroups) {
      try {
        setCustomizationGroups(
          loadout.customizationGroups.map((g) => g.map(fixCustomizations))
        );
      } catch (e) {
        console.error(e);
      }
    }
    setEnableSkillCardOrder(!!loadout.enableSkillCardOrder);
    if (loadout.skillCardIdOrderGroups) {
      setSkillCardIdOrderGroups(loadout.skillCardIdOrderGroups);
    } else {
      if (loadout.stageId === "custom" || Stages.getById(loadout.stageId)?.type !== "linkContest") {
        setSkillCardIdOrderGroups([new Array(loadout.skillCardIdGroups.length * 6 + 8).fill(0)]);
      } else {
        setSkillCardIdOrderGroups([new Array(loadout.skillCardIdGroups.length * 6).fill(0)]);
      }
    }
    if (loadout.customizationOrderGroups) {
      try {
        setCustomizationOrderGroups(
          loadout.customizationOrderGroups.map((g) => g.map(fixCustomizations))
        );
      } catch (e) {
        console.error(e);
      }
    } else {
      if (loadout.stageId === "custom" || Stages.getById(loadout.stageId)?.type !== "linkContest") {
        setCustomizationOrderGroups([new Array(loadout.customizationGroups.length * 6 + 8).fill({})]);
      } else {
        setCustomizationOrderGroups([new Array(loadout.customizationGroups.length * 6).fill({})]);
      }
    }
    setRemovedCardOrder(loadout.removedCardOrder || "random");
    if (loadout.turnTypeOrder) {
      setTurnTypeOrder(loadout.turnTypeOrder);
    } else {
      const turnCounts = loadout.stageId === "custom" ? loadout.customStage.turnCounts :
        Stages.getById(loadout.stageId).turnCounts; 
      setTurnTypeOrder(new Array(turnCounts.vocal + turnCounts.dance + turnCounts.visual).fill("none"));
    }
    setEnableStrategyCustomizations(!!loadout.enableStrategyCustomizations);
    setStrategyCustomizations(loadout.strategyCustomizations || StrategyCustomizations.getDefaults());
    setEnableCardPriorities(!!loadout.enableCardPriorities);
    setPrioritySkillCardIds(loadout.prioritySkillCardIds || [0]);
    setPriorityCustomizations(loadout.priorityCustomizations || [{}]);
    setPriorityValues(loadout.priorityValues || ["100"]);
  }, []);

  useEffect(() => {
    if (["sense", "logic", "anomaly"].includes(stage.plan)) {
      setPlan(stage.plan);
    }

    if (stage.type !== "linkContest") return;
    if (loadouts.length == stage.linkTurnCounts.length) return;

    setLoadouts((cur) => {
      const next = [...cur];
      while (next.length < stage.linkTurnCounts.length) {
        next.push(loadout);
      }
      return next;
    });
  }, [stage]);

  // Update browser URL when the loadout changes
  useEffect(() => {
    if (pathname !== "/simulator" && pathname !== "/contest-player") return;
    updateUrl(loadout, loadouts);
  }, [loadout, loadouts]);

  // Update link loadouts when loadout changes
  useEffect(() => {
    if (stage.type == "linkContest") {
      setLoadouts((cur) => {
        const next = [...cur];
        next[currentLoadoutIndex] = loadout;
        for (let i = 0; i < next.length; i++) {
          next[i].stageId = loadout.stageId;
          next[i].params = [...loadout.params.slice(0, 3), next[i].params[3]];
          next[i].enableSkillCardOrder = loadout.enableSkillCardOrder;
          next[i].removedCardOrder = loadout.removedCardOrder;
          next[i].turnTypeOrder = loadout.turnTypeOrder;
          if (next[i].skillCardIdOrderGroups[0].length !== loadout.skillCardIdOrderGroups[0].length) {
            next[i].skillCardIdOrderGroups = next[i].skillCardIdOrderGroups.map((group) => {
              const size = loadout.skillCardIdOrderGroups[0].length;
              if (group.length < size) {
                return [...group, ...new Array(size - group.length).fill(0)];
              } else if (group.length > size) {
                return group.slice(0, size);
              }
              return group;
            });
          }
          if (next[i].customizationOrderGroups[0].length !== loadout.customizationOrderGroups[0].length) {
            next[i].customizationOrderGroups = next[i].customizationOrderGroups.map((group) => {
              const size = loadout.customizationOrderGroups[0].length;
              if (group.length < size) {
                return [...group, ...new Array(size - group.length).fill({})];
              } else if (group.length > size) {
                return group.slice(0, size);
              }
              return group;
            });
          }
        }
        return next;
      });
    }
  }, [loadout]);

  useEffect(() => {
    // If fewer than 4 pItems, pad with 0s
    if (pItemIds.length < 4) {
      setPItemIds((cur) => cur.concat(new Array(4 - cur.length).fill(0)));
    }
    // If fewer than 4 pDrinkIds, pad with 0s
    if (pDrinkIds.length < 4) {
      setPDrinkIds((cur) => cur.concat(new Array(4 - cur.length).fill(0)));
    }
  }, [pItemIds, pDrinkIds]);

  useEffect(() => {
    const size = STARTING_EFFECTS.length;
    if (startingEffects.length < size) {
      setStartingEffects((cur) => cur.concat(new Array(size - cur.length).fill(0)));
    }
  }, [startingEffects]);

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const memorySlotsRef = useRef(memorySlots);
  memorySlotsRef.current = memorySlots;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const clear = useCallback(() => {
    setMemorySlots([null, null]);
    setParams(getDefaultParams(stageRef.current));
    setPItemIds((cur) => new Array(cur.length).fill(0));
    if (stage.type === "exam") {
      setSkillCardIdGroups([[0]]);
      setCustomizationGroups([[{}]]);
    } else {
      setSkillCardIdGroups([
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ]);
      setCustomizationGroups([
        [{}, {}, {}, {}, {}, {}],
        [{}, {}, {}, {}, {}, {}],
      ]);
    }
    setPDrinkIds((cur) => new Array(cur.length).fill(0));
    setHifAbilityIds((cur) => new Array(cur.length).fill(0));
    setStartingEffects((cur) => new Array(cur.length).fill(0));
    const size = stage.type === "linkContest" ? 12 : stage.type === "exam" ? 1 : 20;
    setEnableSkillCardOrder(false);
    setSkillCardIdOrderGroups([new Array(size).fill(0)]);
    setCustomizationOrderGroups([new Array(size).fill({})]);
    setRemovedCardOrder("random");
    setTurnTypeOrder((cur) => new Array(cur.length).fill("none"));
    setEnableStrategyCustomizations(false);
    setStrategyCustomizations(StrategyCustomizations.getDefaults());
    setEnableCardPriorities(false);
    setPrioritySkillCardIds([0]);
    setPriorityCustomizations([{}]);
    setPriorityValues(["100"]);
  }, [stage]);

  const clearOrders = useCallback(() => {
    const size = stage.type === "exam" ? skillCardIdGroups[0].length : 
      skillCardIdGroups.length * 6 + (stage.type !== "linkContest" ? 8 : 0);
    setSkillCardIdOrderGroups([new Array(size).fill(0)]);
    setCustomizationOrderGroups([new Array(size).fill({})]);
    setRemovedCardOrder("random");
    setTurnTypeOrder((cur) => new Array(cur.length).fill("none"));
  }, [stage]);

  const replacePItemId = useCallback((index, itemId) => {
    setPItemIds((cur) => {
      const next = [...cur];
      next[index] = itemId;
      return next;
    });
  }, []);

  const swapPItemIds = useCallback((indexA, indexB) => {
    setPItemIds((cur) => {
      const next = [...cur];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
  }, []);

  const replacePDrinkId = useCallback((index, drinkId) => {
    setPDrinkIds((cur) => {
      const next = [...cur];
      next[index] = drinkId;
      return next;
    });
  }, []);

  const swapPDrinkIds = useCallback((indexA, indexB) => {
    setPDrinkIds((cur) => {
      const next = [...cur];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
  }, []);

  const replaceHifAbilityId = useCallback((index, abilityId) => {
    setHifAbilityIds((cur) => {
      const next = [...cur];
      next[index] = abilityId;
      return next;
    });
  }, []);

  const swapHifAbilityIds = useCallback((indexA, indexB) => {
    setHifAbilityIds((cur) => {
      const next = [...cur];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
  }, []);

  const replaceStartingEffect = useCallback((index, value) => {
    setStartingEffects((cur) => {
      const next = [...cur];
      next[index] = value;
      return next;
    });
  }, []);

  const replaceCustomizations = useCallback((index, customizations) => {
    setCustomizationGroups((cur) => {
      const curCustomizations = [].concat(...cur);
      const updatedCustomizations = [...curCustomizations];
      updatedCustomizations[index] = customizations;
      let chunks = [];
      const chunkSize = stage.type === "exam" ? updatedCustomizations.length : 6;
      for (let i = 0; i < updatedCustomizations.length; i += chunkSize) {
        chunks.push(updatedCustomizations.slice(i, i + chunkSize));
      }
      return chunks;
    });
  }, [stage]);

  const replaceSkillCardId = useCallback((index, cardId) => {
    let changed = false;
    setSkillCardIdGroups((cur) => {
      const skillCardIds = [].concat(...cur);
      const updatedSkillCardIds = [...skillCardIds];
      if (cardId != updatedSkillCardIds[index]) {
        changed = true;
      }
      updatedSkillCardIds[index] = cardId;
      if (stage.type === "exam" && index === updatedSkillCardIds.length - 1 && !!cardId) {
        updatedSkillCardIds.push(0);
        setCustomizationGroups((cur) => {
          return [[...cur[0], []]];
        });
        setSkillCardIdOrderGroups((cur) => {
          const groups = [...cur];
          groups.forEach((group) => group.push(0));
          return groups;
        });
        setCustomizationOrderGroups((cur) => {
          const groups = [...cur];
          groups.forEach((group) => group.push({}));
          return groups;
        });
      }
      if (stage.type === "exam" && index !== updatedSkillCardIds.length - 1 && !cardId) {
        updatedSkillCardIds.splice(index, 1);
        changed = false;
        setCustomizationGroups((cur) => {
          return [cur[0].toSpliced(index, 1)];
        });
        setSkillCardIdOrderGroups((cur) => {
          const groups = [...cur];
          groups.forEach((group) => group.splice(group.length - 1, 1));
          return groups;
        });
        setCustomizationOrderGroups((cur) => {
          const groups = [...cur];
          groups.forEach((group) => group.splice(group.length - 1, 1));
          return groups;
        });
      }
      let chunks = [];
      const chunkSize = stage.type === "exam" ? updatedSkillCardIds.length : 6;
      for (let i = 0; i < updatedSkillCardIds.length; i += chunkSize) {
        chunks.push(updatedSkillCardIds.slice(i, i + chunkSize));
      }
      return chunks;
    });
    if (changed) {
      replaceCustomizations(index, []);
    }
  }, [stage, replaceCustomizations]);

  const swapSkillCardIds = useCallback((indexA, indexB) => {
    setSkillCardIdGroups((cur) => {
      const skillCardIds = [].concat(...cur);
      const temp = skillCardIds[indexA];
      skillCardIds[indexA] = skillCardIds[indexB];
      skillCardIds[indexB] = temp;
      let chunks = [];
      const chunkSize = stage.type === "exam" ? skillCardIds.length : 6;
      for (let i = 0; i < skillCardIds.length; i += chunkSize) {
        chunks.push(skillCardIds.slice(i, i + chunkSize));
      }
      return chunks;
    });

    setCustomizationGroups((cur) => {
      const curCustomizations = [].concat(...cur);
      const temp = curCustomizations[indexA];
      curCustomizations[indexA] = curCustomizations[indexB];
      curCustomizations[indexB] = temp;
      let chunks = [];
      const chunkSize = stage.type === "exam" ? curCustomizations.length : 6;
      for (let i = 0; i < curCustomizations.length; i += chunkSize) {
        chunks.push(curCustomizations.slice(i, i + chunkSize));
      }
      return chunks;
    });
  }, [stage]);

  const replaceSkillCardOrder = useCallback((groupIndex, index, cardId, customizations) => {
    setSkillCardIdOrderGroups((cur) => {
      const updatedSkillCardIdOrderGroups = cur.map((group) => [...group]);
      updatedSkillCardIdOrderGroups[groupIndex][index] = cardId;
      return updatedSkillCardIdOrderGroups;
    });
    setCustomizationOrderGroups((cur) => {
      const updatedCustomizationOrderGroups = cur.map((group) => [...group]);
      updatedCustomizationOrderGroups[groupIndex][index] = customizations;
      return updatedCustomizationOrderGroups;
    });
  }, []);

  const swapSkillCardOrder = useCallback((indexA, indexB) => {
    const groupIndexA = Math.floor(indexA / skillCardIdOrderGroups[0].length);
    const groupIndexB = Math.floor(indexB / skillCardIdOrderGroups[0].length);
    const arrayIndexA = indexA % skillCardIdOrderGroups[0].length;
    const arrayIndexB = indexB % skillCardIdOrderGroups[0].length;
    setSkillCardIdOrderGroups((cur) => {
      const updated = cur.map((group) => [...group]);
      const temp = updated[groupIndexA][arrayIndexA];
      updated[groupIndexA][arrayIndexA] = updated[groupIndexB][arrayIndexB];
      updated[groupIndexB][arrayIndexB] = temp;
      return updated;
    });
    setCustomizationOrderGroups((cur) => {
      const updated = cur.map((group) => [...group]);
      const temp = updated[groupIndexA][arrayIndexA];
      updated[groupIndexA][arrayIndexA] = updated[groupIndexB][arrayIndexB];
      updated[groupIndexB][arrayIndexB] = temp;
      return updated;
    });
  }, [skillCardIdOrderGroups]);

  const insertSkillCardIdGroup = useCallback((groupIndex) => {
    setSkillCardIdGroups((cur) => {
      const updatedSkillCardIds = [...cur];
      updatedSkillCardIds.splice(groupIndex, 0, [0, 0, 0, 0, 0, 0]);
      return updatedSkillCardIds;
    });
    setCustomizationGroups((cur) => {
      const updatedCustomizations = [...cur];
      updatedCustomizations.splice(groupIndex, 0, []);
      return updatedCustomizations;
    });
    setSkillCardIdOrderGroups((cur) => {
      let updatedSkillCardIdOrderGroups = [...cur];
      updatedSkillCardIdOrderGroups = updatedSkillCardIdOrderGroups.map((skillCardIdOrderGroup) => {
         return [...skillCardIdOrderGroup, 0, 0, 0, 0, 0, 0];
      });
      return updatedSkillCardIdOrderGroups;
    });
    setCustomizationOrderGroups((cur) => {
      let updatedCustomizationOrderGroups = [...cur];
      updatedCustomizationOrderGroups = updatedCustomizationOrderGroups.map((customizationOrderGroup) => {
         return [...customizationOrderGroup, {}, {}, {}, {}, {}, {}];
      });
      return updatedCustomizationOrderGroups;
    });
  }, []);

  const deleteSkillCardIdGroup = useCallback((groupIndex) => {
    setSkillCardIdGroups((cur) => {
      const updatedSkillCardIds = [...cur];
      updatedSkillCardIds.splice(groupIndex, 1);
      return updatedSkillCardIds;
    });
    setCustomizationGroups((cur) => {
      const updatedCustomizations = [...cur];
      updatedCustomizations.splice(groupIndex, 1);
      return updatedCustomizations;
    });
    setSkillCardIdOrderGroups((cur) => {
      let updatedSkillCardIdOrderGroups = [...cur];
      updatedSkillCardIdOrderGroups = updatedSkillCardIdOrderGroups.map((skillCardIdOrderGroup) => {
        skillCardIdOrderGroup.splice(skillCardIdOrderGroup.length-6, 6);
        return skillCardIdOrderGroup;
      });
      return updatedSkillCardIdOrderGroups;
    });
    setCustomizationOrderGroups((cur) => {
      let updatedCustomizationOrderGroups = [...cur];
      updatedCustomizationOrderGroups = updatedCustomizationOrderGroups.map((customizationOrderGroup) => {
        customizationOrderGroup.splice(customizationOrderGroup.length-6, 6);
        return customizationOrderGroup;
      });
      return updatedCustomizationOrderGroups;
    });
  }, []);

  const swapSkillCardIdGroups = useCallback((groupIndexA, groupIndexB) => {
    setSkillCardIdGroups((cur) => {
      const updatedSkillCardIds = [...cur];
      const temp = updatedSkillCardIds[groupIndexA];
      updatedSkillCardIds[groupIndexA] = updatedSkillCardIds[groupIndexB];
      updatedSkillCardIds[groupIndexB] = temp;
      return updatedSkillCardIds;
    });
    setCustomizationGroups((cur) => {
      const updatedCustomizations = [...cur];
      const temp = updatedCustomizations[groupIndexA];
      updatedCustomizations[groupIndexA] = updatedCustomizations[groupIndexB];
      updatedCustomizations[groupIndexB] = temp;
      return updatedCustomizations;
    });
  }, []);

  const selectStage = useCallback((stageId, customStage) => {
    const hasDefaultParams = getDefaultParams(stageRef.current).every(
      (p, i) => p == paramsRef.current[i],
    );
    setStageId(stageId);
    setCustomStage(customStage);
    const nextStage = getStage(stageId, customStage);
    if (hasDefaultParams) {
      setParams(getDefaultParams(nextStage));
    }
    if (nextStage.type === "exam") {
      if (stage.type !== "exam") {
        const MAX_P_ITEMS = 9;
        setPItemIds((cur) => {
          let next = [...cur];
          if (next.length < MAX_P_ITEMS) {
            next = next.concat(new Array(MAX_P_ITEMS - next.length).fill(0));
          } else if (next.length > MAX_P_ITEMS) {
            next = next.slice(0, MAX_P_ITEMS);
          }
          return next;
        });
        setSkillCardIdGroups((cur) => {
          let skillCardIds = [].concat(...cur);
          let appendLast = false;
          if (skillCardIds[skillCardIds.length - 1] !== 0) {
            skillCardIds.push(0);
            appendLast = true;
          }
          let removedIndices = [];
          skillCardIds = skillCardIds.filter((id, i) => {
            if (id === 0 && i < skillCardIds.length - 1) {
              removedIndices.push(i);
              return false;
            } else {
              return true;
            }
          });
          setCustomizationGroups((curCustomizations) => {
            let customizations = [].concat(...curCustomizations);
            if (appendLast) {
              customizations.push({});
            }
            customizations = customizations.filter((c, i) => {
              return !removedIndices.includes(i);
            });
            return [customizations];
          });
          setSkillCardIdOrderGroups((curGroups) => {
            let updatedGroups = curGroups.map((group) => {
              if (group.length > skillCardIds.length - 1) {
                return group.slice(0, skillCardIds.length - 1);
              } else {
                return group.concat(new Array(skillCardIds.length - 1 - group.length).fill(0));
              }
            });
            return updatedGroups;
          });
          setCustomizationOrderGroups((curGroups) => {
            let updatedGroups = curGroups.map((group) => {
              if (group.length > skillCardIds.length - 1) {
                return group.slice(0, skillCardIds.length - 1);
              } else {
                return group.concat(new Array(skillCardIds.length - 1 - group.length).fill({}));
              }
            });
            return updatedGroups;
          });
          return [skillCardIds];
        });
      }
    } else if (stage.type === "exam") {
      // From exam to non-exam, reset to 2 skill card groups
      const MAX_P_ITEMS = 4;
      setPItemIds((cur) => {
        let next = [...cur];
        if (next.length < MAX_P_ITEMS) {
          next = next.concat(new Array(MAX_P_ITEMS - next.length).fill(0));
        } else if (next.length > MAX_P_ITEMS) {
          next = next.slice(0, MAX_P_ITEMS);
        }
        return next;
      });
      setSkillCardIdGroups((cur) => {
        let skillCardIds = [].concat(...cur);
        const size = Math.ceil(skillCardIds.length / 6) * 6;
        skillCardIds = skillCardIds.concat(new Array(size - skillCardIds.length).fill(0));
        let chunks = [];
        const chunkSize = 6;
        for (let i = 0; i < skillCardIds.length; i += chunkSize) {
          chunks.push(skillCardIds.slice(i, i + chunkSize));
        }
        setCustomizationGroups((curCustomizations) => {
          let customizations = [].concat(...curCustomizations);
          customizations = customizations.concat(new Array(size - customizations.length).fill({}));
          let chunks = [];
          const chunkSize = 6;
          for (let i = 0; i < customizations.length; i += chunkSize) {
            chunks.push(customizations.slice(i, i + chunkSize));
          }
          return chunks;
        });
        const deckSize = size + (nextStage.type !== "linkContest" ? 8 : 0);
        setSkillCardIdOrderGroups((curGroups) => {
          let updatedGroups = curGroups.map((group) => {
            return group.concat(new Array(deckSize - group.length).fill(0));
          });
          return updatedGroups;
        });
        setCustomizationOrderGroups((curGroups) => {
          let updatedGroups = curGroups.map((group) => {
            return group.concat(new Array(deckSize - group.length).fill({}));
          });
          return updatedGroups;
        });
        return chunks;
      });
    }
    setSkillCardIdOrderGroups((cur) => {
      const size = nextStage.type === "exam" ? skillCardIdGroups[0].length : 
        skillCardIdGroups.length * 6 + (nextStage.type !== "linkContest" ? 8 : 0);
      let updatedSkillCardIdOrderGroups = [...cur];
      updatedSkillCardIdOrderGroups = updatedSkillCardIdOrderGroups.map((group) => {
        if (group.length < size) {
          return [...group, ...new Array(size - group.length).fill(0)];
        } else if (group.length > size) {
          return group.slice(0, size);
        }
        return group;
      });
      return updatedSkillCardIdOrderGroups;
    });
    setCustomizationOrderGroups((cur) => {
      const size = nextStage.type === "exam" ? skillCardIdGroups[0].length : 
        skillCardIdGroups.length * 6 + (nextStage.type !== "linkContest" ? 8 : 0);
      let updatedCustomizationOrderGroups = [...cur];
      updatedCustomizationOrderGroups = updatedCustomizationOrderGroups.map((group) => {
         if (group.length < size) {
           return [...group, ...new Array(size - group.length).fill({})];
         } else if (group.length > size) {
           return group.slice(0, size);
         }
         return group;
      });
      return updatedCustomizationOrderGroups;
    });
    setTurnTypeOrder((cur) => {
      const updatedTurnTypeOrder = [...cur];
      const turnCounts = nextStage.turnCounts;
      const totalTurns = turnCounts.vocal + turnCounts.dance + turnCounts.visual;
      if (updatedTurnTypeOrder.length < totalTurns) {
        updatedTurnTypeOrder.push(...Array(totalTurns - updatedTurnTypeOrder.length).fill("none"));
      } else if (updatedTurnTypeOrder.length > totalTurns) {
        updatedTurnTypeOrder.length = totalTurns;
      }
      return updatedTurnTypeOrder;
    });
  }, [stage, skillCardIdGroups, pIdolId]);

  const insertSkillCardOrderGroup = useCallback((groupIndex) => {
    setSkillCardIdOrderGroups((cur) => {
      const size = cur[0].length;
      const updatedSkillCardIdOrderGroups = [...cur];
      updatedSkillCardIdOrderGroups.splice(groupIndex, 0, new Array(size).fill(0));
      return updatedSkillCardIdOrderGroups;
    });
    setCustomizationOrderGroups((cur) => {
      const size = cur[0].length;
      const updatedCustomizationOrderGroups = [...cur];
      updatedCustomizationOrderGroups.splice(groupIndex, 0, new Array(size).fill({}));
      return updatedCustomizationOrderGroups;
    });
  }, []);

  const deleteSkillCardOrderGroup = useCallback((groupIndex) => {
    setSkillCardIdOrderGroups((cur) => {
      const updatedSkillCardIdOrderGroups = [...cur];
      updatedSkillCardIdOrderGroups.splice(groupIndex, 1);
      return updatedSkillCardIdOrderGroups;
    });
    setCustomizationOrderGroups((cur) => {
      const updatedCustomizationOrderGroups = [...cur];
      updatedCustomizationOrderGroups.splice(groupIndex, 1);
      return updatedCustomizationOrderGroups;
    });
  }, []);

  const replacePriorityCustomizations = useCallback((index, customization) => {
    setPriorityCustomizations((cur) => {
      const next = [...cur];
      next[index] = customization;
      return next;
    });
  }, []);

  const replacePriorityValues = useCallback((index, value) => {
    setPriorityValues((cur) => {
      const next = [...cur];
      next[index] = value;
      return next;
    });
  }, []);

  const replacePrioritySkillCardId = useCallback((index, cardId) => {
    const next = [...prioritySkillCardIds];
    let changed = cardId != next[index];
    next[index] = cardId;
    if (index === next.length - 1 && !!cardId) {
      next.push(0);
      setPriorityCustomizations((cur) => {
        return [...cur, {}];
      });
      setPriorityValues((cur) => {
        return [...cur, "100"];
      });
    } else if (index !== next.length - 1 && !cardId) {
      next.splice(index, 1);
      changed = false;
      setPriorityCustomizations((cur) => {
        return cur.toSpliced(index, 1);
      });
      setPriorityValues((cur) => {
        return cur.toSpliced(index, 1);
      });
    }
    setPrioritySkillCardIds(next);
    if (changed) {
      replacePriorityCustomizations(index, {});
    }
  }, [prioritySkillCardIds, replacePriorityCustomizations]);

  const swapPrioritySkillCardIds = useCallback((indexA, indexB) => {
    setPrioritySkillCardIds((cur) => {
      const next = [...cur];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
    setPriorityCustomizations((cur) => {
      const next = [...cur];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
    setPriorityValues((cur) => {
      const next = [...cur];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      return next;
    });
  }, []);

  const replaceTurnTypeOrder = useCallback((index, turnType) => {
    setTurnTypeOrder((cur) => {
      const updatedTurnTypeOrder = [...cur];
      updatedTurnTypeOrder[index] = turnType;
      return updatedTurnTypeOrder;
    });
  }, []);

  const swapTurnTypeOrder = useCallback((indexA, indexB) => {
    setTurnTypeOrder((cur) => {
      const updatedTurnTypeOrder = [...cur];
      const temp = updatedTurnTypeOrder[indexA];
      updatedTurnTypeOrder[indexA] = updatedTurnTypeOrder[indexB];
      updatedTurnTypeOrder[indexB] = temp;
      return updatedTurnTypeOrder;
    });
  }, []);

  const setMemory = useCallback((memory, index) => {
    const stage = stageRef.current;
    const multiplier = stage.type !== "linkContest" && index ? 0.2 : 1;
    const applied = setMemorySlot(
      { params: paramsRef.current, slots: memorySlotsRef.current },
      index,
      memory.params,
      multiplier,
    );

    setMemorySlots(applied.slots);
    setParams(applied.params);
    if (index == 0) {
      setPItemIds(memory.pItemIds);
    }
    setSkillCardIdGroups((cur) => {
      const next = [...cur];
      next[index] = memory.skillCardIds;
      return next;
    });
    setCustomizationGroups((cur) => {
      const next = [...cur];
      next[index] = memory.customizations || [];
      return next;
    });
  }, []);

  const actions = useMemo(
    () => ({
      setLoadout,
      setMemory,
      selectStage,
      setSupportBonus,
      setParams,
      replacePItemId,
      swapPItemIds,
      replacePDrinkId,
      swapPDrinkIds,
      replaceHifAbilityId,
      swapHifAbilityIds,
      replaceStartingEffect,
      replaceSkillCardId,
      swapSkillCardIds,
      replaceCustomizations,
      clear,
      setEnableSkillCardOrder,
      replaceSkillCardOrder,
      swapSkillCardOrder,
      insertSkillCardIdGroup,
      deleteSkillCardIdGroup,
      swapSkillCardIdGroups,
      insertSkillCardOrderGroup,
      deleteSkillCardOrderGroup,
      setRemovedCardOrder,
      replaceTurnTypeOrder,
      swapTurnTypeOrder,
      clearOrders,
      setLoadouts,
      setCurrentLoadoutIndex,
      setSkillCardIdGroups,
      setCustomizationGroups,
      setEnableStrategyCustomizations,
      setStrategyCustomizations,
      replacePrioritySkillCardId,
      swapPrioritySkillCardIds,
      replacePriorityCustomizations,
      replacePriorityValues,
      setEnableCardPriorities,
      setPrioritySkillCardIds,
      setPriorityCustomizations,
      setPriorityValues,
    }),
    [
      setLoadout,
      setMemory,
      selectStage,
      replacePItemId,
      swapPItemIds,
      replacePDrinkId,
      swapPDrinkIds,
      replaceHifAbilityId,
      swapHifAbilityIds,
      replaceStartingEffect,
      replaceSkillCardId,
      swapSkillCardIds,
      replaceCustomizations,
      clear,
      setEnableSkillCardOrder,
      replaceSkillCardOrder,
      swapSkillCardOrder,
      insertSkillCardIdGroup,
      deleteSkillCardIdGroup,
      swapSkillCardIdGroups,
      insertSkillCardOrderGroup,
      deleteSkillCardOrderGroup,
      setRemovedCardOrder,
      replaceTurnTypeOrder,
      swapTurnTypeOrder,
      clearOrders,
      replacePrioritySkillCardId,
      swapPrioritySkillCardIds,
      replacePriorityCustomizations,
      replacePriorityValues,
    ]
  );

  const value = useMemo(
    () => ({
      ...actions,
      loadout,
      stage,
      simulatorUrl,
      loadouts,
      currentLoadoutIndex,
    }),
    [actions, loadout, stage, simulatorUrl, loadouts, currentLoadoutIndex]
  );

  return (
    <LoadoutActionsContext.Provider value={actions}>
      <LoadoutContext.Provider value={value}>
        {children}
      </LoadoutContext.Provider>
    </LoadoutActionsContext.Provider>
  );
}

export default LoadoutContext;
