import fox from "@/assets/avatars/fox.png";
import panda from "@/assets/avatars/panda.png";
import unicorn from "@/assets/avatars/unicorn.png";
import tiger from "@/assets/avatars/tiger.png";
import alien from "@/assets/avatars/alien.png";
import robot from "@/assets/avatars/robot.png";
import ghost from "@/assets/avatars/ghost.png";
import penguin from "@/assets/avatars/penguin.png";

/**
 * 3D cartoon avatars. Stored on the profile as `img:<id>` so the existing
 * emoji avatars keep working untouched.
 */
export const AVATAR_IMAGES: Record<string, { src: string; label: string }> = {
  fox: { src: fox, label: "Cool Fox" },
  panda: { src: panda, label: "DJ Panda" },
  unicorn: { src: unicorn, label: "Rainbow Unicorn" },
  tiger: { src: tiger, label: "Street Tiger" },
  alien: { src: alien, label: "Curious Alien" },
  robot: { src: robot, label: "Neon Bot" },
  ghost: { src: ghost, label: "Party Ghost" },
  penguin: { src: penguin, label: "Bling Penguin" },
};

export const IMAGE_AVATAR_CHOICES = Object.keys(AVATAR_IMAGES).map((id) => `img:${id}`);

/** Resolve an avatar value to an image src, or null when it's an emoji. */
export function avatarImage(avatar?: string | null): string | null {
  if (!avatar?.startsWith("img:")) return null;
  return AVATAR_IMAGES[avatar.slice(4)]?.src ?? null;
}