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

export function StopIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v5h5" />
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

export function AgentsIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="6" y="5" width="12" height="10" rx="4" />
      <path d="M9 19v-2M15 19v-2M9.5 9h.01M14.5 9h.01M10 12.2c1.2.8 2.8.8 4 0M12 5V2.5" />
      <circle cx="12" cy="2.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m14 6-6 6 6 6M8 12h11" />
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

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.06.06-2.76 2.76-.06-.06a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21H10v-.09A1.8 1.8 0 0 0 8.9 19.3a1.8 1.8 0 0 0-2 .36l-.06.06-2.76-2.76.06-.06a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.85 14H2v-4h.85A1.8 1.8 0 0 0 4.5 8.9a1.8 1.8 0 0 0-.36-2l-.06-.06 2.76-2.76.06.06a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 10 2.85V2h4v.85a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.06-.06 2.76 2.76-.06.06a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21.15 10H22v4h-.85A1.8 1.8 0 0 0 19.4 15Z" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 8A7 7 0 0 1 18 6l2 6M18 16a7 7 0 0 1-11.9 2L4 12" />
    </svg>
  );
}
