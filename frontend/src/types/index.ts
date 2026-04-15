export interface LoadRequest {
  token: string
  owner: string
  repo: string
  window_days?: number
  load_commit_files?: boolean
}

export interface MetricResult {
  value: number
  p50: number
  p75: number
  p90: number
  base_value: number
  inverse: boolean
}

export interface WasteResult {
  infra_wait_hours: number
  blockage_hours: number
  rework_hours: number
  total_hours: number
}

export interface MetricsSnapshot {
  m01: MetricResult
  m02: MetricResult
  m03: MetricResult
  m04: MetricResult
  m05: MetricResult
  m06: MetricResult
  m07: MetricResult
  m08: MetricResult
  m09: MetricResult
  m10: MetricResult
  m10_available: boolean
  m11: MetricResult
  m12: MetricResult
  m13: MetricResult
  m14: MetricResult
  m15_days: number
  m15_n: number
  m16_waste: WasteResult
}

export interface BundleInfo {
  owner: string
  repo: string
  pr_count: number
  issue_count: number
  window_start: string
  window_end: string
  commit_files_loaded: boolean
}

export type Role = 'Developer' | 'Tech Lead' | 'Engineering Manager' | 'Admin'

export interface AdminStatus {
  configured: boolean
  loaded: boolean
  owner?: string
  repo?: string
  window_days?: number
}


export interface WeeklyData {
  labels: string[]
  m01: number[]
  m02: number[]
  m05: number[]
  m06: number[]
  m08: number[]
  m09: number[]
  m12: number[]
  m13: number[]
  m16: number[]
}

export interface LifecycleData {
  review_wait: number
  ci_wait: number
  other_wait: number
  active: number
}

export interface PROutlier {
  number: number
  title: string
  m01: number
  m02: number
  m10: number
  state: string
  author: string
  created_at: string
}

export interface ScatterPoint {
  pr: number
  title: string
  rci: number
  m01: number
  author: string
}

export interface ModuleActivity {
  module: string
  activity: number
  eo: number
}

export interface HeatmapData {
  modules: string[]
  authors: string[]
  z: number[][]
}

export interface FunnelData {
  step1: number
  step2: number
  step3: number
  onboarding_days: number
}

export interface M11Outlier {
  number: number
  title: string
  cf: number
  changed_files: number
  state: string
  author: string
}

export interface M14Module {
  module: string
  max_share: number
  authors: Record<string, number>
}

export interface ChartsData {
  weekly: WeeklyData
  flow: {
    lifecycle: LifecycleData
    m01_hist: number[]
    m02_hist: number[]
    outliers: PROutlier[]
  }
  load: {
    scatter: ScatterPoint[]
    modules: ModuleActivity[]
  }
  team: {
    heatmap: HeatmapData
    m11_hist: number[]
    m11_outliers: M11Outlier[]
  }
  risks: {
    m15_funnel: FunnelData
    m14_modules: M14Module[]
  }
}


export interface TimelineEvent {
  time: string | null
  icon: string
  type: string
  actor: string
  detail: string
  metric: string | null
}

export interface PRDetail {
  number: number
  title: string
  author: string
  state: string
  changed_files: number
  events: TimelineEvent[]
}
