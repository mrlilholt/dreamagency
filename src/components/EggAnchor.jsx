import { useEggEngine } from "../context/EggContext";

export default function EggAnchor({
  anchorId,
  className = "",
  style,
  onActivate,
  children,
  alwaysVisible = false,
  title
}) {
  const egg = useEggEngine();

  if (!egg || !anchorId) return null;

  const visible = alwaysVisible || egg.hasActiveEggForAnchor(anchorId);
  if (!visible) return null;

  const display = egg.getAnchorDisplay(anchorId);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.(event);
        egg.handleAnchorClick(anchorId);
      }}
      className={`absolute z-20 text-amber-400 opacity-10 hover:opacity-70 transition ${className}`}
      style={style}
      title={title || display.title || "Hidden anchor"}
    >
      {children || display.symbol || "*"}
    </button>
  );
}
