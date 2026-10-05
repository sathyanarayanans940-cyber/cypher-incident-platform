import axios from 'axios'
import type { Analysis, Camera, Incident, Stats } from './types'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cypher_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function login(email: string, password: string) {
  const { data } = await api.post<{ token: string; user: { displayName: string; role: string } }>('/auth/login', { email, password })
  localStorage.setItem('cypher_token', data.token)
  localStorage.setItem('cypher_user', JSON.stringify(data.user))
  return data
}

export async function loadDashboard() {
  const [stats, incidents, cameras] = await Promise.all([
    api.get<Stats>('/dashboard/stats'),
    api.get<Incident[]>('/incidents'),
    api.get<Camera[]>('/cameras'),
  ])
  return { stats: stats.data, incidents: incidents.data, cameras: cameras.data }
}

export async function setIncidentStatus(id: number, status: Incident['status']) {
  const { data } = await api.patch<Incident>(`/incidents/${id}/status`, { status })
  return data
}

export async function analyzeFrame(camera_id: number, session_id: string, sequence: number, frame_base64: string, signal?: AbortSignal) {
  const { data } = await axios.post<Analysis>('/ai/analyze', { camera_id, session_id, sequence, frame_base64 }, { timeout: 15000, signal })
  return data
}
export async function engineHealth() { return (await axios.get<{ status: string; mode: string; frames_processed: number }>('/ai/health', { timeout: 6000 })).data }
export async function reviewIncident(id: number, action: string, note?: string) { return (await api.patch<Incident>(`/incidents/${id}/review`, { action, note })).data }
export async function addCamera(name: string, location: string) { return (await api.post<Camera>('/cameras', { name, location })).data }
export async function toggleCamera(id: number, active: boolean) { return (await api.patch<Camera>(`/cameras/${id}`, { active })).data }
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 || error.response?.status === 403) return 'Your session expired. Sign out and sign in again.'
    const body = error.response?.data
    return typeof body?.detail === 'string' ? body.detail : body?.message || (error.code === 'ECONNABORTED' ? 'The service took too long to respond. Please retry.' : `Request failed${error.response ? ` (${error.response.status})` : ': service unreachable'}.`)
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.'
}
