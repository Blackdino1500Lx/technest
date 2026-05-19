/**
 * Apply teacher branding CSS variables to :root.
 * In demo mode (no 'branding' add-on) colors are stripped to grayscale.
 */
export function applyTheme(primaryColor: string, secondaryColor: string, hasBranding: boolean) {
  const root = document.documentElement
  if (hasBranding) {
    root.style.setProperty('--color-primary',   primaryColor)
    root.style.setProperty('--color-secondary', secondaryColor)
    root.style.setProperty('--color-primary-light', primaryColor + '22')
  } else {
    // Demo mode — grayscale
    root.style.setProperty('--color-primary',   '#6b7280')
    root.style.setProperty('--color-secondary', '#9ca3af')
    root.style.setProperty('--color-primary-light', '#f3f4f6')
  }
}
