import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const common = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ComposeIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m5 12 7-7 7 7M12 19V5" />
    </svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 15h4l2-7 4 11 2-7h4" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

export function PanelIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}
