// Playback mode for Spotify tracks.
// - 'embed'   : in-browser Spotify embed (30s preview, no Premium needed)
// - 'connect' : control the user's Spotify desktop app via the Web API Connect
//               endpoints (full songs, Premium required). Because the audio then
//               comes from a separate application, the streamer can route it to
//               an OBS audio track excluded from the VOD → no DMCA strike on VODs.
export type PlaybackMode = 'embed' | 'connect'

const MODE_KEY = 'blindtest:playbackMode'
const DEVICE_KEY = 'blindtest:spotifyDevice'

export function getPlaybackMode(): PlaybackMode {
  return localStorage.getItem(MODE_KEY) === 'connect' ? 'connect' : 'embed'
}
export function setPlaybackMode(mode: PlaybackMode): void {
  localStorage.setItem(MODE_KEY, mode)
}

export interface SelectedDevice {
  id: string
  name: string
}

export function getSpotifyDevice(): SelectedDevice | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    return raw ? (JSON.parse(raw) as SelectedDevice) : null
  } catch {
    return null
  }
}
export function setSpotifyDevice(device: SelectedDevice | null): void {
  if (device) localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
  else localStorage.removeItem(DEVICE_KEY)
}
