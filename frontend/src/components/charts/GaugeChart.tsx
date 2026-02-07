"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { GaugeChart as EGaugeChart } from "echarts/charts";
import { TooltipComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([EGaugeChart, TooltipComponent, TitleComponent, CanvasRenderer]);

interface GaugeChartProps {
  value: number;
  title: string;
  height?: number;
}

export default function GaugeChart({
  value,
  title,
  height = 180,
}: GaugeChartProps) {
  const option = useMemo(() => {
    return {
      backgroundColor: "transparent",
      series: [
        {
          type: "gauge",
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          radius: "85%",
          progress: {
            show: true,
            width: 12,
            roundCap: true,
            itemStyle: {
              color:
                value < 60
                  ? "#22c55e"
                  : value < 85
                    ? "#f59e0b"
                    : "#ef4444",
            },
          },
          pointer: {
            show: false,
          },
          axisLine: {
            lineStyle: {
              width: 12,
              color: [[1, "#2d3a4f"]],
            },
            roundCap: true,
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            show: true,
            distance: 18,
            fontSize: 9,
            color: "#94a3b8",
            fontFamily: "JetBrains Mono, monospace",
            formatter: (v: number) => {
              if (v === 0 || v === 50 || v === 100) return `${v}`;
              return "";
            },
          },
          anchor: { show: false },
          title: {
            show: true,
            offsetCenter: [0, "40%"],
            fontSize: 11,
            color: "#94a3b8",
            fontFamily: "Inter, sans-serif",
          },
          detail: {
            valueAnimation: true,
            fontSize: 22,
            fontWeight: 600,
            fontFamily: "JetBrains Mono, monospace",
            offsetCenter: [0, "5%"],
            formatter: "{value}%",
            color:
              value < 60
                ? "#22c55e"
                : value < 85
                  ? "#f59e0b"
                  : "#ef4444",
          },
          data: [{ value: Math.round(value * 10) / 10, name: title }],
        },
      ],
    };
  }, [value, title]);

  return (
    <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-2">
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
