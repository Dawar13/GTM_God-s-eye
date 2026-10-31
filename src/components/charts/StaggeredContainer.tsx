"use client";

/**
 * A Recharts `ResponsiveContainer` that draws its chart in a task of its own.
 *
 * Each `ResponsiveContainer` measures its box in an effect and sets state, so charts that hydrate
 * together all draw in the same render: on Command, four charts made one 170–250 ms task.
 * Here charts wait in a page-wide queue and open one at a time, in mount order. A chart opens
 * with its measured width as `initialDimension`, so it draws in that render instead of one more;
 * the next opens after a yield once it has committed. Until its turn a box of the same size
 * holds the space, so nothing shifts.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { yieldToMain } from "@/lib/scheduling";

const waiting: (() => void)[] = [];
let drawing = false;

function next() {
  if (drawing) return;
  const open = waiting.shift();
  if (!open) return;
  drawing = true;
  open();
}

function done() {
  void yieldToMain().then(() => {
    drawing = false;
    next();
  });
}

export function StaggeredContainer({
  height,
  children,
}: {
  height: number;
  children: ReactElement;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  // A new object on every open, so the commit effect below runs even if the width is unchanged.
  const [size, setSize] = useState<{ width: number } | null>(null);
  // True from the moment this chart opens until it has committed (or unmounted).
  const holding = useRef(false);

  useEffect(() => {
    const open = () => {
      holding.current = true;
      setSize({ width: Math.max(1, Math.round(box.current?.getBoundingClientRect().width ?? 1)) });
    };
    waiting.push(open);
    next();
    return () => {
      const at = waiting.indexOf(open);
      if (at >= 0) waiting.splice(at, 1);
      if (holding.current) {
        holding.current = false;
        done();
      }
    };
  }, []);

  useEffect(() => {
    if (size === null || !holding.current) return;
    holding.current = false;
    done();
  }, [size]);

  if (size === null) {
    return <div ref={box} style={{ width: "100%", height, minWidth: 0 }} />;
  }
  return (
    <ResponsiveContainer
      width="100%"
      height={height}
      initialDimension={{ width: size.width, height }}
    >
      {children}
    </ResponsiveContainer>
  );
}
