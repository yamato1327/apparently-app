/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as insightMorning } from './insight-morning.tsx'
import { template as insightNight } from './insight-night.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'insight-morning': insightMorning,
  'insight-night': insightNight,
}
