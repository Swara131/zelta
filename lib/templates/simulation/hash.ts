export function hashSimulationInputs(
  actionId: string,
  inputs: Record<string, string>
): string {
  const normalized = Object.keys(inputs)
    .sort()
    .map((key) => `${key}=${(inputs[key] ?? "").trim()}`)
    .join("&");
  return `${actionId}:${normalized}`;
}
