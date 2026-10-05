export type Incident = {
  id: number
  incidentType: 'THREAT' | 'HEALTH' | 'ACCESS' | 'OTHER'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  assetType: string
  confidence: number
  summary: string
  cameraId: number
  cameraName: string
  location: string
  boundingBox: Record<string, unknown>
  metadata: {
    source?: string; snapshot?: string; rule?: string; explanation?: string[];
    assignee?: string; falsePositive?: boolean; acknowledgedAt?: string;
    timeline?: { at: string; text: string }[]; [key: string]: unknown
  }
  createdAt: string
  resolvedAt?: string
}

export type Priority = Incident['priority'] | 'SAFE'
export type Scenario = 'knife-approach' | 'knife-held' | 'bottle' | 'phone' | 'walk' | 'fall' | 'unclear' | 'bag' | 'obscured'
export type Simulation = { id: string; cameraId: number; scenario: Scenario; startedAt: number; running: boolean; elapsed: number }
export type Analysis = {
  camera_id: number; priority: Priority; summary: string; explanation: string[];
  detections: { asset_type: string; confidence: number; bounding_box: { x: number; y: number; width: number; height: number } }[];
  motion: { moving: boolean; approaching: boolean }; processing_ms: number;
  frame_count: number; sequence: number; processed_at: string; persisted: boolean; created_incident: Incident | null;
}

export type Stats = {
  open: number
  acknowledged: number
  resolved: number
  critical: number
  high: number
}

export type Camera = {
  id: number
  name: string
  location: string
  active: boolean
  projectName: string
}
