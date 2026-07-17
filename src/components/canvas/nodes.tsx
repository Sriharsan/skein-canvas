import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Copy, Sparkles, ArrowDownToLine, Check, Loader2, Workflow, Mail, Webhook } from "lucide-react";
import { toast } from "sonner";

type Status = "idle" | "running" | "done" | "error";

export type WorkflowRef = { id: string; name: string };

export type SkeinNodeData = {
  label?: string;
  prompt?: string;
  starter?: string;
  output?: string;
  status?: Status;
  error?: string;
  runWorkflowId?: string;
  sendEmailTo?: string;
  slackWebhookUrl?: string;
  availableWorkflows?: WorkflowRef[];
  currentWorkflowId?: string;
  onRun?: () => void;
  onChange?: (patch: Partial<SkeinNodeData>) => void;
  /** Sends the node's current output using its saved sendEmailTo/slackWebhookUrl. Throws with a user-facing message on failure. */
  onSendEmail?: () => Promise<void>;
  onSendSlack?: () => Promise<void>;
};

const TAB_COLOR: Record<string, string> = {
  trigger: "var(--moss)",
  llm: "var(--thread)",
  output: "var(--bone)",
  subflow: "var(--wheat)",
};

function StatusDot({ status }: { status?: Status }) {
  if (status === "running") return <Loader2 className="h-3 w-3 animate-spin text-bone/70" />;
  if (status === "done") return <Check className="h-3 w-3 text-moss" />;
  if (status === "error") return <span className="text-destructive text-xs">●</span>;
  return <span className="h-1.5 w-1.5 rounded-full bg-bone/25" />;
}

function NodeShell({
  type, title, icon, data, children,
}: {
  type: keyof typeof TAB_COLOR;
  title: string;
  icon: React.ReactNode;
  data: SkeinNodeData;
  children: React.ReactNode;
}) {
  return (
    <div className="stitch rounded-sm min-w-[220px] max-w-[280px] font-sans text-sm relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: TAB_COLOR[type] }} />
      <div className="pl-4 pr-3 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-bone/60">{icon}</span>
          <span className="text-[13px] tracking-wide">{title}</span>
        </div>
        <StatusDot status={data.status} />
      </div>
      <div className="pl-4 pr-3 py-3">{children}</div>
      <AnimatePresence>
        {data.error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 text-xs text-destructive border-t border-destructive/30 bg-destructive/10"
          >
            {data.error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const TriggerNode = memo(({ data }: NodeProps) => {
  const d = data as SkeinNodeData;
  return (
    <NodeShell type="trigger" title="Trigger" icon={<Play className="h-3.5 w-3.5" />} data={d}>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Input</label>
      <textarea
        className="mt-1 w-full h-16 rounded-sm bg-input border border-border p-2 text-xs resize-none focus:border-primary outline-none"
        placeholder="e.g. Lead inquiry from Alex about wedding photography"
        value={d.starter ?? ""}
        onChange={(e) => d.onChange?.({ starter: e.target.value })}
      />
      <button
        onClick={() => d.onRun?.()}
        className="mt-2 w-full rounded-sm bg-primary text-primary-foreground py-1.5 text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5"
      >
        <Play className="h-3 w-3" /> Run pipeline
      </button>
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
});
TriggerNode.displayName = "TriggerNode";

export const LLMNode = memo(({ data }: NodeProps) => {
  const d = data as SkeinNodeData;
  return (
    <NodeShell type="llm" title="AI Response" icon={<Sparkles className="h-3.5 w-3.5" />} data={d}>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Prompt template</label>
      <textarea
        className="mt-1 w-full h-24 rounded-sm bg-input border border-border p-2 text-xs resize-none focus:border-primary outline-none font-mono"
        placeholder={"Draft a warm reply to:\n{{input}}"}
        value={d.prompt ?? ""}
        onChange={(e) => d.onChange?.({ prompt: e.target.value })}
      />
      <p className="mt-1 text-[10px] text-muted-foreground">Use {"{{input}}"} to insert the previous node's output.</p>
      {d.output && (
        <div className="mt-2 rounded-sm bg-bark border border-border p-2 text-xs whitespace-pre-wrap max-h-32 overflow-auto">
          {d.output}
        </div>
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
});
LLMNode.displayName = "LLMNode";

export const OutputNode = memo(({ data }: NodeProps) => {
  const d = data as SkeinNodeData;
  const [copied, setCopied] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [slackBusy, setSlackBusy] = useState(false);

  async function copy() {
    if (typeof navigator === "undefined" || !d.output) return;
    await navigator.clipboard.writeText(d.output);
    setCopied(true);
    toast("Copied to clipboard.");
    setTimeout(() => setCopied(false), 1500);
  }

  async function sendEmail() {
    if (!d.output || !d.sendEmailTo || emailBusy) return;
    setEmailBusy(true);
    try {
      await d.onSendEmail?.();
      toast.success(`Sent to ${d.sendEmailTo}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the email.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function sendSlack() {
    if (!d.output || !d.slackWebhookUrl || slackBusy) return;
    setSlackBusy(true);
    try {
      await d.onSendSlack?.();
      toast.success("Posted to Slack.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post to Slack.");
    } finally {
      setSlackBusy(false);
    }
  }

  return (
    <NodeShell type="output" title="Output" icon={<ArrowDownToLine className="h-3.5 w-3.5" />} data={d}>
      {d.output ? (
        <>
          <div className="rounded-sm bg-bark border border-border p-2 text-xs whitespace-pre-wrap max-h-40 overflow-auto">
            {d.output}
          </div>
          <button
            onClick={copy}
            className="mt-2 w-full rounded-sm border border-border py-1.5 text-xs hover:bg-secondary flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground italic">Waiting for upstream…</p>
      )}

      <div className="mt-3 pt-3 border-t border-border space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Email to (optional)</label>
          <input
            type="email"
            value={d.sendEmailTo ?? ""}
            onChange={(e) => d.onChange?.({ sendEmailTo: e.target.value })}
            placeholder="client@example.com"
            className="mt-1 w-full rounded-sm bg-input border border-border px-2 py-1.5 text-xs outline-none focus:border-primary"
          />
        </div>
        {d.sendEmailTo && (
          <button
            onClick={sendEmail}
            disabled={!d.output || emailBusy}
            className="w-full rounded-sm border border-border py-1.5 text-xs hover:bg-secondary flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {emailBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
            Send as email
          </button>
        )}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Slack webhook (optional)</label>
          <input
            type="url"
            value={d.slackWebhookUrl ?? ""}
            onChange={(e) => d.onChange?.({ slackWebhookUrl: e.target.value })}
            placeholder="https://hooks.slack.com/…"
            className="mt-1 w-full rounded-sm bg-input border border-border px-2 py-1.5 text-xs outline-none focus:border-primary"
          />
        </div>
        {d.slackWebhookUrl && (
          <button
            onClick={sendSlack}
            disabled={!d.output || slackBusy}
            className="w-full rounded-sm border border-border py-1.5 text-xs hover:bg-secondary flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {slackBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Webhook className="h-3 w-3" />}
            Post to Slack
          </button>
        )}
      </div>

      <Handle type="target" position={Position.Left} />
    </NodeShell>
  );
});
OutputNode.displayName = "OutputNode";

export const SubflowNode = memo(({ data }: NodeProps) => {
  const d = data as SkeinNodeData;
  const available = (d.availableWorkflows ?? []).filter((w) => w.id !== d.currentWorkflowId);
  return (
    <NodeShell type="subflow" title="Run Workflow" icon={<Workflow className="h-3.5 w-3.5" />} data={d}>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Workflow to run</label>
      {available.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground italic">
          Save another workflow first, then pick it here.
        </p>
      ) : (
        <select
          className="mt-1 w-full rounded-sm bg-input border border-border p-2 text-xs outline-none focus:border-primary"
          value={d.runWorkflowId ?? ""}
          onChange={(e) => d.onChange?.({ runWorkflowId: e.target.value || undefined })}
        >
          <option value="">Select a workflow…</option>
          {available.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      )}
      {d.output && (
        <div className="mt-2 rounded-sm bg-bark border border-border p-2 text-xs whitespace-pre-wrap max-h-32 overflow-auto">
          {d.output}
        </div>
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
});
SubflowNode.displayName = "SubflowNode";

export const nodeTypes = {
  trigger: TriggerNode,
  llm: LLMNode,
  output: OutputNode,
  subflow: SubflowNode,
};
