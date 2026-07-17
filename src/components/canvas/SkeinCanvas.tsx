import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, type SkeinNodeData, type WorkflowRef } from "./nodes";
import { edgeTypes } from "./thread-edge";
import { runLLMNode } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export type WorkflowSnapshot = { nodes: Node[]; edges: Edge[] };

type Props = {
  initial?: WorkflowSnapshot;
  readOnly?: boolean;
  onDirtyChange?: (snap: WorkflowSnapshot) => void;
  palette?: boolean;
  demo?: boolean;
  currentWorkflowId?: string;
  availableWorkflows?: WorkflowRef[];
  /** Loads another workflow's snapshot for Run-Workflow nodes. */
  loadWorkflow?: (id: string) => Promise<WorkflowSnapshot | null>;
  onRunSuccess?: () => void;
};

const DEMO_REPLY = `Hi Alex,

Thank you so much for reaching out about your June 14 wedding — congratulations! I'd love to be part of the day.

I have June 14 open right now, and based on what you've shared, my "Full Day" collection is likely the best fit: 8 hours of coverage, a second shooter, and a private online gallery within three weeks. I can send over the full guide (with sample galleries from two recent weddings) as soon as I know a bit more:

  • Ceremony + reception venue(s)
  • Rough headcount
  • What time you'd like coverage to begin

If it's easier, here's my calendar for a 20-minute intro call: [link]

Talk soon,
— [Your name]`;

const DEFAULT_SNAP: WorkflowSnapshot = {
  nodes: [
    { id: "t1", type: "trigger", position: { x: 40, y: 120 }, data: { starter: "Lead: Alex wants wedding photos for June 14. Budget flexible." } },
    { id: "l1", type: "llm", position: { x: 320, y: 80 }, data: { prompt: "Draft a warm, professional reply to this inquiry:\n\n{{input}}" } },
    { id: "o1", type: "output", position: { x: 640, y: 140 }, data: {} },
  ],
  edges: [
    { id: "e1", source: "t1", target: "l1", type: "thread" },
    { id: "e2", source: "l1", target: "o1", type: "thread" },
  ],
};

export function SkeinCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <SkeinCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function SkeinCanvasInner({
  initial, readOnly, onDirtyChange, palette, demo,
  currentWorkflowId, availableWorkflows, loadWorkflow, onRunSuccess,
}: Props) {
  const snap = initial ?? DEFAULT_SNAP;
  const [nodes, setNodes] = useState<Node[]>(snap.nodes);
  const [edges, setEdges] = useState<Edge[]>(snap.edges);
  const runAI = useServerFn(runLLMNode);
  const idCounter = useRef(1);

  useEffect(() => { onDirtyChange?.({ nodes, edges }); }, [nodes, edges, onDirtyChange]);

  const patchNode = useCallback((id: string, patch: Partial<SkeinNodeData>) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, []);

  const setEdgeRunning = useCallback((sourceId: string, targetId: string, running: boolean) => {
    setEdges((es) => es.map((e) =>
      e.source === sourceId && e.target === targetId
        ? { ...e, data: { ...(e.data ?? {}), running } }
        : e
    ));
  }, []);

  // Run a subflow (recursive, headless) with cycle detection.
  const runSubflow = useCallback(async (
    workflowId: string, input: string, visited: Set<string>,
  ): Promise<string> => {
    if (visited.has(workflowId)) {
      throw new Error("Cycle detected: this workflow already runs upstream.");
    }
    if (!loadWorkflow) throw new Error("Sub-workflows aren't available here.");
    const wf = await loadWorkflow(workflowId);
    if (!wf) throw new Error("That workflow could not be loaded.");
    const nextVisited = new Set(visited); nextVisited.add(workflowId);

    const outMap = new Map<string, string>();
    const trigger = wf.nodes.find((n) => n.type === "trigger");
    if (!trigger) throw new Error("Sub-workflow has no Trigger node.");
    // Sub-workflow trigger receives upstream input instead of its own starter.
    outMap.set(trigger.id, input || String((trigger.data as SkeinNodeData).starter ?? ""));

    const queue: string[] = [trigger.id];
    const seen = new Set<string>([trigger.id]);
    let last = outMap.get(trigger.id) ?? "";
    while (queue.length) {
      const cur = queue.shift()!;
      const outgoing = wf.edges.filter((e) => e.source === cur);
      for (const e of outgoing) {
        if (seen.has(e.target)) continue;
        seen.add(e.target);
        const tgt = wf.nodes.find((n) => n.id === e.target);
        if (!tgt) continue;
        const inputText = outMap.get(cur) ?? "";
        let out = "";
        const td = tgt.data as SkeinNodeData;
        if (tgt.type === "llm") {
          const promptTpl = String(td.prompt ?? "");
          const finalPrompt = promptTpl.replaceAll("{{input}}", inputText) || inputText;
          const res = await runAI({ data: { prompt: finalPrompt } });
          out = res.text;
        } else if (tgt.type === "subflow") {
          if (!td.runWorkflowId) throw new Error("Nested Run Workflow node has no target selected.");
          out = await runSubflow(td.runWorkflowId, inputText, nextVisited);
        } else {
          out = inputText;
        }
        outMap.set(e.target, out);
        last = out;
        queue.push(e.target);
      }
    }
    return last;
  }, [loadWorkflow, runAI]);

  const runFrom = useCallback(async (startId: string) => {
    if (readOnly) return;
    setNodes((ns) => ns.map((n) => ({
      ...n,
      data: { ...n.data, status: "idle", output: n.type === "trigger" ? n.data.output : undefined, error: undefined },
    })));
    const outputs = new Map<string, string>();
    const start = nodes.find((n) => n.id === startId);
    if (!start) return;
    outputs.set(startId, String(start.data.starter ?? ""));
    patchNode(startId, { status: "done", output: String(start.data.starter ?? "") });

    let hadError = false;
    const queue: string[] = [startId];
    const visited = new Set<string>();
    while (queue.length) {
      const cur = queue.shift()!;
      const outgoing = edges.filter((e) => e.source === cur);
      for (const e of outgoing) {
        if (visited.has(e.target)) continue;
        visited.add(e.target);
        const targetNode = nodes.find((n) => n.id === e.target);
        if (!targetNode) continue;
        const inputText = outputs.get(cur) ?? "";
        setEdgeRunning(e.source, e.target, true);
        patchNode(e.target, { status: "running", error: undefined });
        try {
          let out = "";
          const td = targetNode.data as SkeinNodeData;
          if (targetNode.type === "llm") {
            if (demo) {
              await new Promise((r) => setTimeout(r, 1400));
              out = DEMO_REPLY;
            } else {
              const promptTpl = String(td.prompt ?? "");
              const finalPrompt = promptTpl.replaceAll("{{input}}", inputText) || inputText;
              const res = await runAI({ data: { prompt: finalPrompt } });
              out = res.text;
            }
          } else if (targetNode.type === "subflow") {
            const targetWfId = td.runWorkflowId;
            if (!targetWfId) throw new Error("Pick a workflow to run in this node.");
            if (currentWorkflowId && targetWfId === currentWorkflowId) {
              throw new Error("A workflow can't run itself.");
            }
            const visitedWorkflows = new Set<string>();
            if (currentWorkflowId) visitedWorkflows.add(currentWorkflowId);
            out = await runSubflow(targetWfId, inputText, visitedWorkflows);
          } else if (targetNode.type === "output") {
            out = inputText;
          } else {
            out = inputText;
          }
          outputs.set(e.target, out);
          patchNode(e.target, { status: "done", output: out });
          queue.push(e.target);
        } catch (err) {
          hadError = true;
          const msg = err instanceof Error ? err.message : "Node failed";
          patchNode(e.target, { status: "error", error: msg });
          toast.error(msg);
        } finally {
          setEdgeRunning(e.source, e.target, false);
        }
      }
    }
    if (!hadError) {
      onRunSuccess?.();
    }
  }, [readOnly, nodes, edges, runAI, patchNode, setEdgeRunning, demo, runSubflow, currentWorkflowId, onRunSuccess]);

  const enhancedNodes = useMemo(() => nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      availableWorkflows,
      currentWorkflowId,
      onChange: (patch: Partial<SkeinNodeData>) => patchNode(n.id, patch),
      onRun: () => runFrom(n.id),
    },
  })), [nodes, patchNode, runFrom, availableWorkflows, currentWorkflowId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (readOnly) return;
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, [readOnly]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (readOnly) return;
    setEdges((es) => applyEdgeChanges(changes, es));
  }, [readOnly]);
  const onConnect = useCallback((conn: Connection) => {
    if (readOnly) return;
    setEdges((es) => addEdge({ ...conn, type: "thread" }, es));
  }, [readOnly]);

  const addNode = (type: "trigger" | "llm" | "output" | "subflow") => {
    const id = `${type}_${Date.now()}_${idCounter.current++}`;
    setNodes((ns) => [...ns, {
      id, type, position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 100 }, data: {},
    }]);
  };

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={enhancedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: false }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        panOnDrag={!readOnly}
        zoomOnScroll={!readOnly}
      >
        <Background gap={24} size={1} />
        {!readOnly && <Controls showInteractive />}
        {!readOnly && <MiniMap pannable zoomable maskColor="oklch(0.198 0.018 55 / 0.7)" nodeColor={() => "var(--thread)"} />}
      </ReactFlow>
      {palette && !readOnly && (
        <div className="absolute top-3 left-3 stitch rounded-sm p-2 flex flex-col gap-1.5 text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1">Add node</span>
          <button onClick={() => addNode("trigger")} className="text-left px-3 py-1.5 hover:bg-secondary rounded-sm">Trigger</button>
          <button onClick={() => addNode("llm")} className="text-left px-3 py-1.5 hover:bg-secondary rounded-sm">AI Response</button>
          <button onClick={() => addNode("subflow")} className="text-left px-3 py-1.5 hover:bg-secondary rounded-sm">Run Workflow</button>
          <button onClick={() => addNode("output")} className="text-left px-3 py-1.5 hover:bg-secondary rounded-sm">Output</button>
        </div>
      )}
    </div>
  );
}
