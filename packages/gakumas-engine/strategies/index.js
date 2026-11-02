import HeuristicStrategy from "./HeuristicStrategy";
import ManualStrategy from "./ManualStrategy";
import ProbabilisticBeamStrategy from "./ProbabilisticBeamStrategy";

const STRATEGIES = {
  HeuristicStrategy,
  ManualStrategy,
  ProbabilisticBeamStrategy,
};

export { ManualStrategy, ProbabilisticBeamStrategy };
export default STRATEGIES;
