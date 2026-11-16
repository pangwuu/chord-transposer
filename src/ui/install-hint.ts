/**
 * Whether to suggest adding the app to the Home Screen. Safari on iPhone and iPad clears a site's
 * storage after about a week without a visit unless the app is installed, and that storage is what
 * keeps this browser in its band. Other browsers on iOS cannot install, so they are not asked.
 */
export function wantsInstallHint({ userAgent, standalone, dismissed }: { userAgent: string; standalone: boolean; dismissed: boolean }): boolean {
  if (dismissed || standalone) return false
  const apple = /iPhone|iPad|iPod/.test(userAgent)
  const safari = /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent)
  return apple && safari
}

/** True when the page is running as an installed app rather than in a browser tab. */
export function runningInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
}
