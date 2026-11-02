import { useTranslations } from "next-intl";
import ButtonGroup from "./ButtonGroup";

export default function StrategyPicker({ strategy, setStrategy }) {
  const t = useTranslations("StrategyPicker");

  const STRATEGY_OPTIONS = [
    { value: "HeuristicStrategy", label: t("auto") },
    { value: "ProbabilisticBeamStrategy", label: t("beam") },
    { value: "ManualStrategy", label: t("manual") },
  ];

  return (
    <ButtonGroup
      options={STRATEGY_OPTIONS}
      selected={strategy}
      onChange={setStrategy}
    />
  );
}
