import React from 'react';
import { format } from 'date-fns';
import { useWeightUnit } from '../../hooks/useWeightUnit';

export interface VolumePoint {
  date: Date;
  volume: number;
  templateId: string | null;
  templateName: string;
  category: 'Upper Body' | 'Lower Body' | 'Core Focused' | 'Whole Body';
  isPR?: boolean;
}

interface VolumeGraphProps {
  data: VolumePoint[];
}

const VolumeGraph: React.FC<VolumeGraphProps> = ({ data }) => {
  const { convertWeight, unit } = useWeightUnit();
  
  if (data.length < 2) return null;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const height = 260;
  const padding = { top: 20, right: 10, bottom: 20, left: 10 };
  const graphWidth = Math.max(width - padding.left - padding.right, 0);

  // Group data by template
  const templateGroups = data.reduce((acc, point) => {
    const key = point.templateId ? `${point.templateId}-${point.templateName}` : 'Other';
    if (!acc[key]) {
      acc[key] = {
        name: point.templateName || 'Other',
        points: []
      };
    }
    acc[key].points.push({
      ...point,
      volume: convertWeight(point.volume) // Convert volume to user's preferred unit
    });
    return acc;
  }, {} as Record<string, { name: string; points: VolumePoint[] }>);

  // Generate colors for each template with better contrast
  const colors = {
    'Other': '#9333ea', // Purple for uncategorized
    ...Object.fromEntries(
      Object.keys(templateGroups).map((key, i) => [
        key,
        [
          '#2563eb', // Blue
          '#dc2626', // Red
          '#16a34a', // Green
          '#14b8a6', // Teal
          '#7c3aed', // Violet
          '#0891b2', // Cyan
          '#c026d3', // Fuchsia
          '#65a30d', // Lime
        ][i % 8]
      ])
    )
  };

  // Calculate scales using converted values
  const maxVolume = Math.max(...data.map(d => convertWeight(d.volume)));
  const minVolume = Math.min(...data.map(d => convertWeight(d.volume)));

  // Add 10% padding to the y-axis for better visibility
  const volumeRange = maxVolume - minVolume || 1;
  const paddedMin = minVolume - volumeRange * 0.1;
  const paddedMax = maxVolume + volumeRange * 0.1;

  const yScale = (height - padding.top - padding.bottom) / (paddedMax - paddedMin);
  const xScale = graphWidth / (data.length - 1);

  // Format y-axis labels
  const formatYLabel = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  // Calculate y-axis label positions
  const yLabelPositions = [
    { value: paddedMax, y: padding.top + 15 },
    { value: (paddedMax + paddedMin) / 2, y: (height - padding.bottom + padding.top) / 2 },
    { value: paddedMin, y: height - padding.bottom - 15 }
  ];

  // Get unique dates for x-axis
  const dates = [...new Set(data.map(d => d.date.toISOString()))].sort();

  return (
    <div className="bg-white rounded-lg p-2 -mt-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Volume Progression</h3>
        <span className="text-sm text-gray-500">in {unit}</span>
      </div>

      <div ref={containerRef} className="relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Grid lines */}
          {dates.map((date, i) => {
            const x = padding.left + i * xScale;
            return (
              <line
                key={i}
                x1={x}
                y1={padding.top}
                x2={x}
                y2={height - padding.bottom}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
            );
          })}

          {/* Y-axis labels */}
          {yLabelPositions.map(({ value, y }, i) => (
            <text
              key={i}
              x={padding.left + 5}
              y={y}
              textAnchor="start"
              alignmentBaseline="middle"
              className="text-xs fill-gray-500"
            >
              {formatYLabel(value)}
            </text>
          ))}

          {/* Lines for each template */}
          {Object.entries(templateGroups).map(([key, group]) => {
            const color = colors[key as keyof typeof colors] || colors['Other'];
            
            // Create points array with x,y coordinates
            const points = dates.map(date => {
              const point = group.points.find(p => p.date.toISOString() === date);
              if (!point) return null;
              const x = padding.left + dates.indexOf(date) * xScale;
              const y = height - padding.bottom - (point.volume - paddedMin) * yScale;
              return { x, y, isPR: point.isPR };
            });

            // Filter out null points and create line segments
            const validPoints = points.filter((p): p is { x: number; y: number; isPR?: boolean } => p !== null);
            const pathSegments = validPoints.map((point, i) =>
              i === 0 ? `M ${point.x},${point.y}` : `L ${point.x},${point.y}`
            );

            // Create star path for a point
            const createStarPath = (cx: number, cy: number, size: number) => {
              const points = [];
              for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const x = cx + Math.cos(angle) * size;
                const y = cy + Math.sin(angle) * size;
                points.push(`${i === 0 ? 'M' : 'L'} ${x},${y}`);

                const innerAngle = angle + Math.PI / 5;
                const innerX = cx + Math.cos(innerAngle) * (size * 0.4);
                const innerY = cy + Math.sin(innerAngle) * (size * 0.4);
                points.push(`L ${innerX},${innerY}`);
              }
              points.push('Z');
              return points.join(' ');
            };

            return (
              <g key={key}>
                {/* Draw the line */}
                <path
                  d={pathSegments.join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
                {/* Draw points */}
                {validPoints.map((point, i) => (
                  point.isPR ? (
                    <path
                      key={i}
                      d={createStarPath(point.x, point.y, 6)}
                      fill="#f59e0b"
                      stroke="#d97706"
                      strokeWidth="1"
                      className="transition-all duration-300"
                    />
                  ) : (
                    <circle
                      key={i}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill={color}
                      stroke="white"
                      strokeWidth="1.5"
                      className="transition-all duration-300"
                    />
                  )
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
        {Object.entries(templateGroups).map(([key, group]) => {
          const color = colors[key as keyof typeof colors] || colors['Other'];
          const truncatedName = group.name.length > 7 ? group.name.substring(0, 7) : group.name;
          return (
            <div key={key} className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-6 h-1" style={{ backgroundColor: color, borderRadius: '2px' }} />
                <div className="w-2 h-2 rounded-full border border-white" style={{ backgroundColor: color, boxShadow: '0 0 0 0.5px white' }} />
              </div>
              <span className="text-xs font-medium text-gray-700">{truncatedName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VolumeGraph;