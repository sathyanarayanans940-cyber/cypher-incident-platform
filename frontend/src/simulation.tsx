import { useEffect, useRef } from 'react'
import { analyzeFrame, errorMessage } from './api'
import type { Analysis, Camera, Scenario, Simulation } from './types'

export const scenarios: { value: Scenario; label: string; detail: string }[] = [
  { value: 'knife-approach', label: 'Sharp object · approaching person', detail: 'A pointed blade and directed movement' },
  { value: 'knife-held', label: 'Sharp object · standing still', detail: 'A pointed blade without directed movement' },
  { value: 'bottle', label: 'Smooth object · bottle', detail: 'A rounded everyday object' },
  { value: 'phone', label: 'Smooth object · phone', detail: 'A compact rectangular everyday object' },
  { value: 'walk', label: 'Normal walking', detail: 'People walking with empty hands' },
  { value: 'fall', label: 'Health event · person falls', detail: 'A person falls and remains on the floor' },
  { value: 'unclear', label: 'Unclear object · review', detail: 'An elongated object with an obscured tip' },
  { value: 'bag', label: 'Unattended bag', detail: 'An object remains without a person nearby' },
  { value: 'obscured', label: 'Camera view obscured', detail: 'A blank feed that needs a camera check' },
]

export function drawScene(ctx: CanvasRenderingContext2D, scenario: Scenario, seconds: number, cameraId: number) {
  const w = 320, h = 180
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#d9e1e3'; ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#c8d4d8'; ctx.fillRect(0, 0, w, 92)
  for (let i = 0; i < 6; i++) {
    const x = 15 + i * 51 + (cameraId % 3) * 2
    ctx.fillStyle = '#aebfc5'; ctx.fillRect(x, 20, 26, 81)
    ctx.fillStyle = '#dfe8e9'; ctx.fillRect(x + 4, 26, 18, 27)
  }
  ctx.fillStyle = '#becdd1'; ctx.fillRect(0, 132, w, 1)
  if (scenario === 'obscured') { ctx.fillStyle = '#d3d9dc'; ctx.fillRect(0, 0, w, h); return }
  const t = Math.max(0, seconds)
  let x = scenario === 'knife-approach' ? 70 + Math.min(t, 8) * 13 : scenario === 'knife-held' ? 110 : 95 + Math.sin(t * .45 + cameraId) * 24
  function person(px: number, fallen = false, stationary = false) {
    ctx.save(); ctx.translate(px, 145)
    if (fallen) ctx.rotate(-Math.min(Math.max(t - .6, 0), 1) * Math.PI / 2)
    ctx.fillStyle = '#657d86'; ctx.strokeStyle = '#657d86'; ctx.lineCap = 'round'; ctx.lineWidth = 7
    ctx.beginPath(); ctx.arc(0, -63, 6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.roundRect(-6, -57, 12, 32, 4); ctx.fill()
    const step = stationary || fallen ? 1 : Math.sin(t * 4.5) * 5
    ctx.beginPath(); ctx.moveTo(-3, -26); ctx.lineTo(-5 + step, -4); ctx.moveTo(3, -26); ctx.lineTo(5 - step, -4); ctx.stroke()
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-6, -49); ctx.lineTo(-11 - step / 2, -30); ctx.moveTo(6, -49); ctx.lineTo(16, -35); ctx.lineTo(24, -36); ctx.stroke()
    ctx.restore()
  }
  if (scenario === 'bag') { ctx.fillStyle = '#29353b'; ctx.beginPath(); ctx.roundRect(177, 120, 20, 18, 3); ctx.fill(); return }
  person(x, scenario === 'fall', scenario === 'knife-held')
  if (scenario === 'knife-approach' || scenario === 'walk') person(257, false, true)
  const ox = x + 23, oy = 106
  ctx.fillStyle = '#29353b'
  if (scenario === 'knife-held' || scenario === 'knife-approach') {
    ctx.fillRect(ox, oy + 1, 10, 5)
    ctx.beginPath(); ctx.moveTo(ox + 9, oy - 3); ctx.lineTo(ox + 35, oy + 2); ctx.lineTo(ox + 11, oy + 6); ctx.closePath(); ctx.fill()
  } else if (scenario === 'bottle') {
    ctx.beginPath(); ctx.roundRect(ox + 1, oy - 8, 11, 21, 5); ctx.fill(); ctx.fillRect(ox + 4, oy - 11, 5, 5)
  } else if (scenario === 'phone') ctx.fillRect(ox + 1, oy - 8, 8, 17)
  else if (scenario === 'unclear') ctx.fillRect(ox, oy, 27, 7)
}

export function SimulationRunner({ simulation, onAnalysis, onError, onDone }: { simulation: Simulation | null; onAnalysis: (a: Analysis) => void; onError: (e: string) => void; onDone: () => void }) {
  const callbacks = useRef({ onAnalysis, onError, onDone })
  callbacks.current = { onAnalysis, onError, onDone }
  useEffect(() => {
    if (!simulation?.running) return
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180
    const ctx = canvas.getContext('2d')!
    const abort = new AbortController()
    let timer = 0, sequence = 0, failures = 0
    async function sample() {
      if (abort.signal.aborted) return
      if (document.hidden) { timer = window.setTimeout(sample, 1200); return }
      const t = (Date.now() - simulation!.startedAt) / 1000
      drawScene(ctx, simulation!.scenario, t, simulation!.cameraId)
      try {
        const a = await analyzeFrame(simulation!.cameraId, simulation!.id, sequence++, canvas.toDataURL('image/png'), abort.signal)
        if (abort.signal.aborted) return
        callbacks.current.onAnalysis(a); failures = 0
        if (sequence >= 9) { callbacks.current.onDone(); return }
      } catch (error) {
        if (abort.signal.aborted) return
        callbacks.current.onError(errorMessage(error)); failures++
        if (failures >= 3) { callbacks.current.onDone(); return }
      }
      timer = window.setTimeout(sample, 1100)
    }
    timer = window.setTimeout(sample, 450)
    return () => { abort.abort(); window.clearTimeout(timer) }
  }, [simulation?.id, simulation?.running])
  return null
}

export function CameraFeed({ camera, simulation, analysis, paused = false }: { camera: Camera; simulation: Simulation | null; analysis?: Analysis; paused?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const result = useRef(analysis); result.current = analysis
  const active = simulation?.cameraId === camera.id ? simulation : null
  useEffect(() => {
    const el = canvas.current; if (!el) return
    const ctx = el.getContext('2d')!; let animation = 0, last = 0
    function draw(now: number) {
      animation = requestAnimationFrame(draw)
      if (document.hidden || now - last < 50) return
      last = now
      const seconds = active ? active.running ? (Date.now() - active.startedAt) / 1000 : active.elapsed : (Date.now() / 1000) % 30
      drawScene(ctx, active?.scenario || 'walk', paused ? 2 : seconds, camera.id)
      if (active && result.current) {
        for (const d of result.current.detections) {
          const b = d.bounding_box
          ctx.strokeStyle = d.asset_type === 'person' ? '#087f73' : result.current.priority === 'SAFE' ? '#087f73' : '#c54949'
          ctx.lineWidth = .8; ctx.strokeRect(b.x * 320 - 2, b.y * 180 - 2, b.width * 320 + 4, b.height * 180 + 4)
          ctx.font = '7px sans-serif'; ctx.fillStyle = ctx.strokeStyle
          ctx.fillText(d.asset_type.toUpperCase(), Math.max(2, b.x * 320 - 2), Math.max(25, b.y * 180 - 5))
        }
      }
    }
    animation = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animation)
  }, [active?.id, active?.running, active?.elapsed, camera.id, paused])
  if (!camera.active) return <div className="feed-offline"><strong>Feed paused</strong><span>Resume this camera to run a simulation</span></div>
  return <div className="live-feed">
    <canvas ref={canvas} width={320} height={180} aria-label={`Animated simulation for ${camera.name}`} />
    <span className="feed-status">{active?.running ? '● ANALYZING' : '● SIMULATION'}</span>
    <span className="feed-source">CAM-{String(camera.id).padStart(2, '0')}</span>
    {active && analysis && <span className={`feed-result ${analysis.priority.toLowerCase()}`}>{analysis.priority === 'SAFE' ? 'No threat' : analysis.priority} · {analysis.detections.map(d => d.asset_type).filter((x,i,a) => a.indexOf(x) === i).join(', ') || 'View obscured'}</span>}
  </div>
}
