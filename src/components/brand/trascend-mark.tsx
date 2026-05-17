import Image from "next/image";

interface TrevixeMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

export function TrevixeMark({
  size = 24,
  className,
  title,
}: TrevixeMarkProps) {
  return (
    <Image
      src="/logo.svg"
      alt={title ?? "Trevixe"}
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

/** @deprecated use TrevixeMark */
export const TrascendMark = TrevixeMark;
