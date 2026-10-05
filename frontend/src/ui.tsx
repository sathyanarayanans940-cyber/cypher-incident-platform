import type { ReactNode } from 'react'
import type { Incident, Priority } from './types'

export const priorities: Incident['priority'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
export const severity = (p: string) => priorities.indexOf(p as Incident['priority'])
export const time = (s: string) => new Date(s).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
export const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
export const idLabel = (id: number) => `INC-${String(id).padStart(4, '0')}`
export const statusLabel = (s: string) => s === 'ACKNOWLEDGED' ? 'In progress' : s === 'RESOLVED' ? 'Resolved' : 'Open'
export function duration(ms: number | null) { if (ms === null) return '—'; const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s` }
export function averageResolution(items: Incident[]) { const done = items.filter(i => i.resolvedAt); return done.length ? done.reduce((s, i) => s + new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime(), 0) / done.length : null }
export function Badge({ value }: { value: Priority | string }) { return <span className={`priority-tag ${value.toLowerCase()}`}>{value === 'SAFE' ? 'Safe' : value}</span> }
export function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <div className="stat-card"><span className="muted">{label}</span><strong>{value}</strong><small>{detail}</small></div> }
export function Panel({ title, description, actions, children, className = '' }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) { return <section className={`panel ${className}`}><div className="panel-header"><div><h3>{title}</h3>{description && <p>{description}</p>}</div>{actions}</div>{children}</section> }
export function Empty({ children }: { children: ReactNode }) { return <div className="empty-state"><span>○</span><p>{children}</p></div> }
export function download(name: string, content: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export function csv(rows: (string | number)[][]) { return rows.map(row => row.map(v => { let s = String(v); if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"` }).join(',')).join('\r\n') }
export function exportIncidents(items: Incident[]) { download('cypher-incidents.csv', csv([['ID', 'Event', 'Type', 'Priority', 'Status', 'Camera', 'Location', 'Created at', 'Source'], ...items.map(i => [idLabel(i.id), i.summary, i.incidentType, i.priority, i.status, i.cameraName, i.location, i.createdAt, i.metadata.source || 'legacy'])]), 'text/csv;charset=utf-8') }
