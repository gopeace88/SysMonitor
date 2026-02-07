"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart as EBarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  EBarChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  CanvasRenderer,
]);

interface BarDataItem {
  label: string;
  value: number;
  max: number;
}

interface BarChartProps {
  data: BarDataItem[];
  title: string;
  height?: number;
}

export default function BarChart({ data, title, height = 200 }: BarChartProps) {
  const option = useMemo(() => {
    const labels = data.map((d) => d.label);
    const usedValues = data.map((d) => d.value);
    const freeValues = data.map((d) => d.max - d.value);

    return {
      backgroundColor: "transparent",
      title: {
        text: title,
        left: "left",
        textStyle: {
          color: "#e2e8f0",
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "Inter, sans-serif",
        },
      },
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#1e293b",
        borderColor: "#2d3a4f",
        textStyle: {
          color: "#e2e8f0",
          fontSize: 11,
          fontFamily: "JetBrains Mono, monospace",
        },
        formatter: (params: Array<{ name: string; seriesName: string; value: number }>) => {
          const item = data.find((d) => d.label === params[0].name);
          if (!item) return "";
          const pct = ((item.value / item.max) * 100).toFixed(1);
          const toGB = (v: number) => (v / (1024 * 1024 * 1024)).toFixed(1);
          return `<b>${item.label}</b><br/>Used: ${toGB(item.value)} GB<br/>Total: ${toGB(item.max)} GB<br/>Usage: ${pct}%`;
        },
      },
      grid: {
        top: 35,
        right: 15,
        bottom: 10,
        left: 10,
        containLabel: true,
      },
      xAxis: {
        type: "value" as const,
        show: false,
        max: (v: { max: number }) => v.max,
      },
      yAxis: {
        type: "category" as const,
        data: labels,
        axisLabel: {
          color: "#94a3b8",
          fontSize: 10,
          fontFamily: "JetBrains Mono, monospace",
        },
        axisLine: { lineStyle: { color: "#2d3a4f" } },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Used",
          type: "bar",
          stack: "total",
          data: usedValues.map((v, i) => ({
            value: v,
            itemStyle: {
              color:
                (v / data[i].max) * 100 < 60
                  ? "#22c55e"
                  : (v / data[i].max) * 100 < 85
                    ? "#f59e0b"
                    : "#ef4444",
              borderRadius: [0, 0, 0, 0],
            },
          })),
          barWidth: 16,
        },
        {
          name: "Free",
          type: "bar",
          stack: "total",
          data: freeValues,
          itemStyle: { color: "#2d3a4f" },
          barWidth: 16,
        },
      ],
    };
  }, [data, title]);

  return (
    <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: `${height}px`, width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}
