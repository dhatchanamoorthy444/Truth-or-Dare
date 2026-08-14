import { avatarImage } from "@/lib/avatars";

/** Renders a 3D cartoon avatar image, falling back to the emoji avatar. */
export function PlayerAvatar({
  avatar,
  size = 32,
  className = "",
}: {
  avatar?: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const src = avatarImage(avatar);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 object-contain drop-shadow-[0_4px_14px_oklch(0_0_0/45%)] ${className}`}
      />
    );
  }
  return (
    <span
      style={{ fontSize: size * 0.85, lineHeight: 1 }}
      className={`shrink-0 ${className}`}
    >
      {avatar ?? "🎲"}
    </span>
  );
}