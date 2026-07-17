import type { WorkflowSnapshot } from "@/components/canvas/SkeinCanvas";

export type Template = {
  key: string;
  name: string;
  blurb: string;
  snapshot: WorkflowSnapshot;
};

function makeSnap(starter: string, prompt: string): WorkflowSnapshot {
  return {
    nodes: [
      { id: "t1", type: "trigger", position: { x: 40, y: 140 }, data: { starter } },
      { id: "l1", type: "llm", position: { x: 340, y: 90 }, data: { prompt } },
      { id: "o1", type: "output", position: { x: 680, y: 160 }, data: {} },
    ],
    edges: [
      { id: "e1", source: "t1", target: "l1", type: "thread" },
      { id: "e2", source: "l1", target: "o1", type: "thread" },
    ],
  };
}

export const TEMPLATES: Template[] = [
  {
    key: "inquiry",
    name: "Client inquiry reply",
    blurb: "A new lead comes in. Draft a warm, specific first reply.",
    snapshot: makeSnap(
      "Lead: Alex wants wedding photos for June 14. Budget flexible.",
      "Draft a warm, professional reply to this inquiry. Ask 2-3 concrete questions and mention next steps:\n\n{{input}}",
    ),
  },
  {
    key: "follow-up",
    name: "Proposal follow-up",
    blurb: "The proposal's been sitting quiet. Draft a light check-in that isn't pushy.",
    snapshot: makeSnap(
      "Sent proposal to Priya (brand identity, $4,800) eight days ago. No reply. Prior emails were friendly.",
      "Draft a short, polite follow-up email checking in on the proposal. Reference what was sent, offer to answer questions, and suggest a quick call. Do not apologize or beg. Do not offer a discount:\n\n{{input}}",
    ),
  },
  {
    key: "scope-creep",
    name: "Scope creep response",
    blurb: "Client asks for extra work outside the agreement. Set a firm, friendly boundary.",
    snapshot: makeSnap(
      "Client (mid-project logo design, fixed scope) just asked me to also design their pitch deck. Not in scope. Not budgeted.",
      "Draft a warm but firm reply. Confirm we can absolutely help with the deck, but note it's outside the current scope, and propose it as a separate mini-engagement with its own timeline and quote. No apology, no over-explaining:\n\n{{input}}",
    ),
  },
];
