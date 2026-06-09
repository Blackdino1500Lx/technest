/**
 * Apply teacher branding CSS variables to :root.
 * Sets --coral / --teal (used throughout the CSS) so all UI elements update.
 */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + amount)
  const g = Math.min(255, ((num >> 8) & 0xff) + amount)
  const b = Math.min(255, (num & 0xff) + amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function applyTheme(primaryColor: string, secondaryColor: string, hasBranding: boolean) {
  const root = document.documentElement
  if (hasBranding) {
    root.style.setProperty('--coral',       primaryColor)
    root.style.setProperty('--coral-dark',  darken(primaryColor, 30))
    root.style.setProperty('--teal',        secondaryColor)
    root.style.setProperty('--teal-light',  lighten(secondaryColor, 30))
  } else {
    // No branding: revert to defaults
    root.style.removeProperty('--coral')
    root.style.removeProperty('--coral-dark')
    root.style.removeProperty('--teal')
    root.style.removeProperty('--teal-light')
  }
}
