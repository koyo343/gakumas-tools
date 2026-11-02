import {
  FaBook,
  FaCalculator,
  FaChartSimple,
  FaFilm,
  FaGamepad,
  FaTrophy,
} from "react-icons/fa6";

export const TOOLS = {
  produceRankCalculator: {
    icon: <FaCalculator />,
    path: "/calculator",
    pinnable: true,
  },
  dex: {
    icon: <FaBook />,
    path: "/dex",
    pinnable: true,
  },
  memories: {
    icon: <FaFilm />,
    path: "/memories",
    pinnable: true,
  },
  simulator: {
    icon: <FaTrophy />,
    path: "/simulator",
    pinnable: true,
  },
  contestPlayer: {
    icon: <FaGamepad />,
    path: "/contest-player",
    pinnable: true,
  },
  rehearsal: {
    icon: <FaChartSimple />,
    path: "/rehearsal",
    pinnable: true,
  },
};
