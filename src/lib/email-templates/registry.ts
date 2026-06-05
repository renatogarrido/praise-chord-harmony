import type { ComponentType } from 'react'
import { template as worshipScheduleAssignment } from './worship-schedule-assignment'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'worship-schedule-assignment': worshipScheduleAssignment,
}
