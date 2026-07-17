import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { motion } from "framer-motion";

export function ThreadEdge(props: EdgeProps) {
  const [path] = getBezierPath({
    sourceX: props.sourceX, sourceY: props.sourceY,
    targetX: props.targetX, targetY: props.targetY,
    sourcePosition: props.sourcePosition, targetPosition: props.targetPosition,
  });
  const running = (props.data as { running?: boolean } | undefined)?.running;
  return (
    <>
      <BaseEdge id={props.id} path={path} style={{ stroke: "var(--thread)", strokeWidth: 1.5, opacity: 0.7 }} />
      {running && (
        <motion.path
          d={path}
          fill="none"
          stroke="var(--bone)"
          strokeWidth={2.5}
          strokeDasharray="8 120"
          strokeLinecap="round"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -256 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          style={{ pointerEvents: "none" }}
        />
      )}
    </>
  );
}

export const edgeTypes = { thread: ThreadEdge };
