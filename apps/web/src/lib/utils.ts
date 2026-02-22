import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Type declarations for Intl.DurationFormat (not yet in TypeScript's lib)
interface DurationInput {
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
}

interface DurationFormatOptions {
  style?: 'long' | 'short' | 'narrow' | 'digital'
  localeMatcher?: 'best fit' | 'lookup'
}

declare namespace Intl {
  class DurationFormat {
    constructor(locale?: string, options?: DurationFormatOptions)
    format(duration: DurationInput): string
  }
}

/**
 * Formats a duration in seconds to a human-readable relative time string.
 * Uses Intl.DurationFormat for locale-aware formatting.
 * E.g., 90 -> "1 minute", 3661 -> "1 hour, 1 minute", 90061 -> "1 day, 1 hour, 1 minute"
 */
export function formatUptime(seconds: number): string {
  if (seconds < 0) seconds = 0

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const duration: DurationInput = {}

  if (days > 0) duration.days = days
  if (hours > 0) duration.hours = hours
  if (minutes > 0) duration.minutes = minutes
  
  // Only show seconds if uptime is less than 1 minute
  if (Object.keys(duration).length === 0) {
    duration.seconds = secs
  }

  const formatter = new Intl.DurationFormat('en', { style: 'long' })
  return formatter.format(duration)
}

/**
 * Formats a UTC datetime string to a human-readable relative time.
 * E.g., "30s ago", "2m ago", "1h ago", "3d ago"
 * When staleThresholdDays is set, returns "-" for dates older than that.
 */
export function formatRelativeTime(dateString: string, staleThresholdDays?: number): string {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return "-"
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (staleThresholdDays !== undefined) {
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays > staleThresholdDays) return "-"
  }
  const diffSeconds = Math.floor(diffMs / 1000)
  
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`
  }
  
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
