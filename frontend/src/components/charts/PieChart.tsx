"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { PieChart as EPieChart } from "echarts/charts";
import {
  TooltipComponent,
  TitleComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  EPieChart,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface PieDataItem {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieDataItem[];
  title: string;
  height?: number;
  formatter?: (value: number) => string;
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function PieChart({ data, title, height = 260, formatter }: PieChartProps) {
  const option = useMemo(() => {
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
        trigger: "item" as const,
        backgroundColor: "#1e293b",
        borderColor: "#2d3a4f",
        textStyle: {
          color: "#e2e8f0",
          fontSize: 11,
          fontFamily: "JetBrains Mono, monospace",
        },
        formatter: (params: { name: string; value: number; percent: number }) => {
          const val = formatter ? formatter(params.value) : params.value.toLocaleString();
          return `<b>${params.name}</b><br/>${val} (${params.percent}%)`;
        },
      },
      legend: {
        orient: "vertical" as const,
        right: 10,
        top: 35,
        textStyle: {
          color: "#94a3b8",
          fontSize: 10,
          fontFamily: "JetBrains Mono, monospace",
        },
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          center: ["35%", "55%"],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: "bold" as const,
              color: "#e2e8f0",
            },
          },
          labelLine: { show: false },
          data: data.map((d, i) => ({
            ...d,
            itemStyle: { color: COLORS[i % COLORS.length] },
          })),
        },
      ],
    };
  }, [data, title, formatter]);

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
