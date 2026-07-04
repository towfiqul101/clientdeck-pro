/** Deterministic avatar helpers for agency rows (initials + color from name). */

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-fuchsia-500",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Tailwind classes for the status dot next to an agency. */
export function statusDotClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-500";
    case "trialing":
      return "bg-blue-500";
    case "past_due":
      return "bg-amber-500";
    case "paused":
      return "bg-gray-400";
    case "cancelled":
      return "bg-red-500";
    default:
      return "bg-gray-300";
  }
}
