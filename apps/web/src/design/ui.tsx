import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle,
  ChevronDown,
  CircleDot,
  Clock,
  Download,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  Gauge,
  Github,
  Globe,
  Info,
  LayoutDashboard,
  List,
  Loader2,
  Monitor,
  Moon,
  Play,
  Plus,
  ScanSearch,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sun,
  type LucideIcon
} from "lucide-react";
import { severityMeta, type FindingStatus, type ScanStatus, type Severity, type Viewport } from "../data";

const iconMap = {
  activity: Activity,
  "alert-circle": AlertCircle,
  "alert-octagon": AlertOctagon,
  "alert-triangle": AlertTriangle,
  "arrow-right": ArrowRight,
  "book-open": BookOpen,
  check: Check,
  "check-circle": CheckCircle,
  "chevron-down": ChevronDown,
  "circle-dot": CircleDot,
  clock: Clock,
  download: Download,
  eye: Eye,
  "file-text": FileText,
  folder: Folder,
  "folder-plus": FolderPlus,
  gauge: Gauge,
  github: Github,
  globe: Globe,
  info: Info,
  "layout-dashboard": LayoutDashboard,
  list: List,
  loader: Loader2,
  monitor: Monitor,
  moon: Moon,
  play: Play,
  plus: Plus,
  "scan-search": ScanSearch,
  search: Search,
  settings: Settings,
  "shield-check": ShieldCheck,
  smartphone: Smartphone,
  sun: Sun
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 16, className, strokeWidth = 2 }: IconProps) {
  const Component = iconMap[name];
  return <Component aria-hidden="true" className={className} size={size} strokeWidth={strokeWidth} />;
}

type ButtonVariant = "primary" | "default" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
}

export function Button({ variant = "default", size, icon, iconRight, children, className = "", ...rest }: ButtonProps) {
  const iconSize = size === "sm" ? 13 : 14;
  const classes = ["btn", variant, size ?? "", children === undefined ? "icon-only" : "", className].filter(Boolean).join(" ");

  return (
    <button className={classes} type="button" {...rest}>
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={iconSize} /> : null}
    </button>
  );
}

export function Panel({ title, subtitle, action, children, className = "" }: { title?: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title !== undefined || action !== undefined) && (
        <div className="panel-h">
          <div>
            {title !== undefined ? <h3>{title}</h3> : null}
            {subtitle !== undefined ? <div className="sub">{subtitle}</div> : null}
          </div>
          {action}
        </div>
      )}
      <div className="panel-b">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, breadcrumb, actions, icon }: { title: string; subtitle?: ReactNode; breadcrumb?: ReactNode; actions?: ReactNode; icon?: IconName }) {
  return (
    <div className="page-header">
      <div>
        {breadcrumb ? <div className="breadcrumb">{breadcrumb}</div> : null}
        <h1>{icon ? <Icon name={icon} size={19} /> : null}{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function SeverityBadge({ level }: { level: Severity }) {
  return (
    <span className={`badge severity ${level}`}>
      <SeverityIcon level={level} />
      {severityMeta[level].label}
    </span>
  );
}

export function SeverityIcon({ level }: { level: Severity }) {
  const name: IconName = level === "critical" ? "alert-octagon" : level === "serious" ? "alert-triangle" : level === "moderate" ? "alert-circle" : "info";
  return <Icon name={name} size={12} />;
}

export function StatusBadge({ status }: { status: FindingStatus }) {
  const label = status === "new" ? "New" : status === "resolved" ? "Resolved" : "Ongoing";
  const icon: IconName = status === "new" ? "circle-dot" : status === "resolved" ? "check-circle" : "clock";
  return (
    <span className={`badge status ${status}`}>
      <Icon name={icon} size={11} />
      {label}
    </span>
  );
}

export function RunStatusBadge({ status }: { status: ScanStatus }) {
  const label = status[0].toUpperCase() + status.slice(1);
  const icon: IconName = status === "completed" ? "check-circle" : status === "failed" ? "alert-octagon" : status === "queued" ? "clock" : "loader";
  return (
    <span className={`badge run ${status}`}>
      <Icon name={icon} size={11} className={icon === "loader" ? "spin" : undefined} />
      {label}
    </span>
  );
}

export function ViewportBadge({ viewport }: { viewport: Viewport }) {
  if (viewport === "both") {
    return (
      <span className="inline-meta">
        <Icon name="monitor" size={13} />
        <Icon name="smartphone" size={12} />
        Both
      </span>
    );
  }

  return (
    <span className="inline-meta">
      <Icon name={viewport === "desktop" ? "monitor" : "smartphone"} size={13} />
      {viewport === "desktop" ? "Desktop" : "Mobile"}
    </span>
  );
}

export function Progress({ value, color = "var(--accent)", tall = false }: { value: number; color?: string; tall?: boolean }) {
  return (
    <div className={`progress ${tall ? "tall" : ""}`} aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.max(0, Math.min(100, score));
  const color = normalized >= 85 ? "var(--resolved)" : normalized >= 70 ? "var(--moderate)" : "var(--serious)";

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--panel-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - normalized / 100)}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <span className="score-value">{normalized}</span>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}

export function Toggle({ checked, onChange, label, description, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-title">{label}</div>
        {description ? <div className="toggle-desc">{description}</div> : null}
      </div>
      <button
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? "on" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <i />
      </button>
    </div>
  );
}

export const uiStyles = "";
