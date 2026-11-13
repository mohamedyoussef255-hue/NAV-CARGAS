import { Station, UserLocation } from '../types';

export interface StationNavUrls {
  lat: number;
  lng: number;
  hasValidCoords: boolean;
  label: string;
  geoUri: string;
  googleMapsUrl: string;
  appleMapsUrl: string;
}

export function getStationNavigationUrls(
  station: Station,
  userLoc?: UserLocation | null
): StationNavUrls {
  const lat = Number(station.lat ?? station.latitude);
  const lng = Number(station.lng ?? station.longitude);
  const hasValidCoords =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 15 &&
    lat <= 40 &&
    lng >= 15 &&
    lng <= 50;

  const label = (station.stationName || station.name || 'محطة كارجاس').trim();
  const safeLat = hasValidCoords ? lat : 30.0444;
  const safeLng = hasValidCoords ? lng : 31.2357;

  const geoUri = `geo:${safeLat},${safeLng}?q=${safeLat},${safeLng}(${encodeURIComponent(label)})`;

  const hasValidOrigin =
    Boolean(userLoc) &&
    Number.isFinite(Number(userLoc?.lat)) &&
    Number.isFinite(Number(userLoc?.lng)) &&
    Number(userLoc?.lat) >= 15 &&
    Number(userLoc?.lat) <= 40;

  const googleMapsUrl = hasValidOrigin
    ? `https://www.google.com/maps/dir/?api=1&origin=${Number(userLoc!.lat)},${Number(userLoc!.lng)}&destination=${safeLat},${safeLng}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLng}&travelmode=driving`;

  const appleMapsUrl = `https://maps.apple.com/?daddr=${safeLat},${safeLng}&dirflg=d`;

  return {
    lat: safeLat,
    lng: safeLng,
    hasValidCoords,
    label,
    geoUri,
    googleMapsUrl,
    appleMapsUrl,
  };
}

/**
 * Checks whether the current runtime can natively intercept `geo:` links
 * without failing silently (Android outside restricted sandboxed iframes).
 */
export function canLaunchNativeGeoUri(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  const isAndroid = /android/i.test(ua);
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  return isAndroid && !inIframe;
}
