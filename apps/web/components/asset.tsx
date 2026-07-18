import Image from "next/image";

const folders: Record<string, string> = {
  icon: "icons",
  mascot: "mascot",
  illustration: "illustrations",
  avatar: "avatars",
  badge: "badges",
  cover: "course-covers",
  game: "games",
  background: "backgrounds",
  pattern: "patterns",
  decoration: "decorations",
  empty: "empty-states",
  brand: "brand"
};

export function Asset({
  type,
  name,
  alt,
  width,
  height,
  className,
  priority = false
}: {
  type: keyof typeof folders;
  name: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={`/assets/${folders[type]}/${name}.svg`}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
