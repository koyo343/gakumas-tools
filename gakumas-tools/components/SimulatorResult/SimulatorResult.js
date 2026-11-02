import { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import styles from "./SimulatorResult.module.scss";

function getSummary(scores) {
  if (!scores || scores.length === 0) return null;
  const sorted = [...scores].sort((a, b) => a - b);
  const total = scores.reduce((sum, score) => sum + score, 0);
  return {
    min: sorted[0],
    average: Math.round(total / scores.length),
    median: sorted[Math.floor((sorted.length - 1) / 2)],
    max: sorted[sorted.length - 1],
  };
}

function SimulatorResult({ pending, data }) {
  const t = useTranslations("SimulatorResult");
  const summary = useMemo(() => getSummary(data?.scores), [data?.scores]);

  if (!summary) return null;

  return (
    <div
      id="simulator_result"
      className={`${styles.result}${pending ? ` ${styles.pending}` : ""}`}
      aria-busy={pending}
    >
      <div className={styles.contents}>
        <div className={styles.scoreTiles}>
          {["min", "average", "median", "max"].map((key) => (
            <div className={styles.scoreTile} key={key}>
              <span>{t(key)}</span>
              <strong>{summary[key].toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(SimulatorResult);
