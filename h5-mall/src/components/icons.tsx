// 无印风单色线框图标 — 统一 stroke:#666, stroke-width:1.5, 20px
// 全部手写 SVG path，零依赖

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export const IconHome = (p: { size?: number }) => <Icon size={p.size} d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
export const IconGrid = (p: { size?: number }) => <Icon size={p.size} d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
export const IconLeaf = (p: { size?: number }) => <Icon size={p.size} d="M12 2C8 6 2 10 2 14a6 6 0 0 0 12 3.5A6 6 0 0 0 22 14c0-4-6-8-10-12z" />
export const IconCart = (p: { size?: number }) => <Icon size={p.size} d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
export const IconUser = (p: { size?: number }) => <Icon size={p.size} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
export const IconSearch = (p: { size?: number }) => <Icon size={p.size} d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />
export const IconBox = (p: { size?: number }) => <Icon size={p.size} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
export const IconBell = (p: { size?: number }) => <Icon size={p.size} d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
export const IconCheck = (p: { size?: number }) => <Icon size={p.size} d="M20 6L9 17l-5-5" />
export const IconChevronRight = (p: { size?: number }) => <Icon size={p.size} d="M9 18l6-6-6-6" />
export const IconArrowLeft = (p: { size?: number }) => <Icon size={p.size} d="M19 12H5M12 19l-7-7 7-7" />
export const IconX = (p: { size?: number }) => <Icon size={p.size} d="M18 6L6 18M6 6l12 12" />
export const IconPlus = (p: { size?: number }) => <Icon size={p.size} d="M12 5v14M5 12h14" />
export const IconMinus = (p: { size?: number }) => <Icon size={p.size} d="M5 12h14" />
export const IconMapPin = (p: { size?: number }) => <Icon size={p.size} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
export const IconPhone = (p: { size?: number }) => <Icon size={p.size} d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
export const IconClock = (p: { size?: number }) => <Icon size={p.size} d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" />
export const IconTag = (p: { size?: number }) => <Icon size={p.size} d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />
export const IconBook = (p: { size?: number }) => <Icon size={p.size} d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />
export const IconSparkles = (p: { size?: number }) => <Icon size={p.size} d="M12 3l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
export const IconShoppingBag = (p: { size?: number }) => <Icon size={p.size} d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
export const IconFlame = (p: { size?: number }) => <Icon size={p.size} d="M12 2C8.5 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2.5-7-6-12z" />
export const IconCalendar = (p: { size?: number }) => <Icon size={p.size} d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
export const IconBeads = (p: { size?: number }) => <Icon size={p.size} d="M17 4a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM7 15a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2zM12 2a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM12 19a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1z" />
export const IconSun = (p: { size?: number }) => <Icon size={p.size} d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />

// Shared category → icon mapping
export function CatIcon({ name, size = 22 }: { name: string; size?: number }) {
  const m: Record<string, React.ReactNode> = {
    '经书': <IconBook size={size} />,
    '法器': <IconBell size={size} />,
    '念珠': <IconBeads size={size} />,
    '香品': <IconFlame size={size} />,
    '佛像': <IconSparkles size={size} />,
    '文创': <IconTag size={size} />,
  }
  return <>{m[name] || <IconBox size={size} />}</>
}
