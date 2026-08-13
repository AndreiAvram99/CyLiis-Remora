import Image from "next/image";

/**
 * The remora fades from navy to white, so one drawing can't sit on both pages:
 * the pale tail sinks into a white one, the navy body into a dark one. Both
 * tones ship, and the theme hides the one that would disappear.
 */
export function BrandMark({
  size,
  priority = false,
}: {
  size: number;
  priority?: boolean;
}) {
  return (
    <>
      <Image
        src="/logo.png"
        alt="CyLiis Remora"
        width={size}
        height={size}
        priority={priority}
        className="show-on-dark"
      />
      <Image
        src="/logo-light.png"
        alt=""
        aria-hidden
        width={size}
        height={size}
        priority={priority}
        className="show-on-light"
      />
    </>
  );
}
