export function buildPieSlicePaths(
  segments: { value: number }[],
  cx: number,
  cy: number,
  radius: number,
  startOffset = -90
): string[] {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {
    return segments.map(() => "");
  }

  const { paths } = segments.reduce<{ cumulativeAngle: number; paths: string[] }>(
    (acc, segment) => {
      const angle = (segment.value / total) * 360;
      const startAngle = acc.cumulativeAngle;
      const endAngle = acc.cumulativeAngle + angle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;
      const path =
        angle >= 359.9
          ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy}`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      return {
        cumulativeAngle: endAngle,
        paths: [...acc.paths, path],
      };
    },
    { cumulativeAngle: startOffset, paths: [] }
  );

  return paths;
}
