import type { ComponentType } from "react";
import Intro from "./01-intro";
import Problem from "./02-problem";
import Hashing from "./03-hashing";
import Inside from "./03b-inside";
import KeysSlide from "./04-keys";
import Transactions from "./05-transactions";
import Blocks from "./06-blocks";
import Mining from "./07-mining";
import ChainDemo from "./08-chain";
import Network from "./09-network";
import BigPicture from "./10-bigpicture";
import Outro from "./11-outro";

export type Slide = {
  id: string; // url-friendly, used in the hash (e.g. #hashing)
  title: string; // short label for a11y / tooltips
  chapter: string; // grouping shown in the top-right
  Component: ComponentType;
};

export const slides: Slide[] = [
  { id: "intro", title: "How does Bitcoin work?", chapter: "Start", Component: Intro },
  { id: "problem", title: "The problem", chapter: "Start", Component: Problem },
  { id: "hashing", title: "The hash", chapter: "Foundations", Component: Hashing },
  { id: "inside", title: "Inside the hash", chapter: "Foundations", Component: Inside },
  { id: "keys", title: "Keys & signatures", chapter: "Foundations", Component: KeysSlide },
  { id: "transactions", title: "Transactions", chapter: "Money", Component: Transactions },
  { id: "blocks", title: "Blocks", chapter: "Money", Component: Blocks },
  { id: "mining", title: "Proof of work", chapter: "Consensus", Component: Mining },
  { id: "chain", title: "Immutability", chapter: "Consensus", Component: ChainDemo },
  { id: "network", title: "The network", chapter: "Consensus", Component: Network },
  { id: "bigpicture", title: "The big picture", chapter: "Big picture", Component: BigPicture },
  { id: "outro", title: "You're done", chapter: "Big picture", Component: Outro },
];
