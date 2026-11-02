/** A player's profile picture when they have one, otherwise their emoji. */
export function PlayerAvatar({ emoji, image, className = "" }: { emoji: string; image?: string | null; className?: string }) {
  if (image) return <img src={image} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  return <span className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`}>{emoji}</span>;
}
