"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  CanvasRenderer,
]);

interface TimeSeriesDataPoint {
  timestamp: number | string;
  value: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  title: string;
  color?: string;
  height?: number;
  yAxisFormat?: (value: number) => string;
}

export default function TimeSeriesChart({
  data,
  title,
  color = "#3b82f6",
  height = 200,
  yAxisFormat,
}: TimeSeriesChartProps) {
  const option = useMemo(() => {
    const timestamps = data.map((d) => {
      const ts = typeof d.timestamp === "number" ? d.timestamp * 1000 : d.timestamp;
      const date = new Date(ts);
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    });
    const values = data.map((d) => d.value);

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
        backgroundColor: "#1e293b",
        borderColor: "#2d3a4f",
        textStyle: {
          color: "#e2e8f0",
          fontSize: 11,
          fontFamily: "JetBrains Mono, monospace",
        },
        axisPointer: {
          type: "cross" as const,
          lineStyle: { color: "#475569" },
          crossStyle: { color: "#475569" },
        },
      },
      grid: {
        top: 35,
        right: 15,
        bottom: 25,
        left: 50,
        containLabel: false,
      },
      xAxis: {
        type: "category" as const,
        data: timestamps,
        axisLabel: {
          color: "#94a3b8",
          fontSize: 10,
          fontFamily: "JetBrains Mono, monospace",
        },
        axisLine: { lineStyle: { color: "#2d3a4f" } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: {
          color: "#94a3b8",
          fontSize: 10,
          fontFamily: "JetBrains Mono, monospace",
          formatter: yAxisFormat || ((v: number) => String(v)),
        },
        axisLine: { lineStyle: { color: "#2d3a4f" } },
        splitLine: { lineStyle: { color: "#2d3a4f", type: "dashed" as const } },
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 1.5, color },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: color + "40" },
              { offset: 1, color: color + "05" },
            ]),
          },
        },
      ],
    };
  }, [data, title, color, yAxisFormat]);

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
