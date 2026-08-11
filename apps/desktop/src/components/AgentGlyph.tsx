export function AgentGlyph({
  id,
  provider,
  label,
}: {
  id: string;
  provider: "codex" | "claude";
  label?: string;
}) {
  const tone = [...id].reduce((value, character) => value + character.charCodeAt(0), 0) % 6;
  return (
    <span
      className={`agent-glyph ${provider} tone-${tone}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
