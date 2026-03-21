export const manifest = {
  name: 'geo-plugin',
  id: 'geo-plugin',
  version: '1.0.0',
  description: 'Geolocation and geographic utilities',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;

export async function init(context) {
  api = context;
  api.log('Geo plugin initialized');
}

export async function activate(context) {
  api.log('Geo plugin activated');
}

export function deactivate() {
  api.log('Geo plugin deactivated');
}

export const functions = {
  distance: (lat1, lon1, lat2, lon2, unit = 'km') => {
    const R = { km: 6371, m: 6371000, mi: 3959, ft: 20902231, nm: 3440 }[unit] || 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  midpoint: (lat1, lon1, lat2, lon2) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const bx = Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    const by = Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon);
    const lat3 = Math.atan2(Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180), Math.sqrt((Math.cos(lat1 * Math.PI / 180) + bx) ** 2 + by ** 2));
    const lon3 = lon1 + Math.atan2(by, Math.cos(lat1 * Math.PI / 180) + bx);
    return { lat: lat3 * 180 / Math.PI, lon: lon3 * 180 / Math.PI };
  },

  bearing: (lat1, lon1, lat2, lon2) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  },

  destination: (lat, lon, distance, bearing, unit = 'km') => {
    const R = { km: 6371, m: 6371000, mi: 3959, ft: 20902231 }[unit] || 6371;
    const d = distance / R;
    const brng = bearing * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
  },

  bounds: (points) => {
    const lats = points.map(p => p.lat), lons = points.map(p => p.lon);
    return {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLon: Math.min(...lons), maxLon: Math.max(...lons),
      center: { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 }
    };
  },

  pointInCircle: (pointLat, pointLon, centerLat, centerLon, radius, unit = 'km') => {
    const dist = functions.distance(pointLat, pointLon, centerLat, centerLon, unit);
    return { inside: dist <= radius, distance: dist };
  },

  pointInPolygon: (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lon, yi = polygon[i].lat, xj = polygon[j].lon, yj = polygon[j].lat;
      if (((yi > point.lat) !== (yj > point.lat)) && (point.lon < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  },

  bbox: (lat, lon, distance, unit = 'km') => {
    const R = { km: 111.32, m: 0.11132, mi: 111.32 * 0.621371, degrees: 1 }[unit] || 111.32;
    return {
      minLat: lat - (distance / R), maxLat: lat + (distance / R),
      minLon: lon - (distance / (R * Math.cos(lat * Math.PI / 180))), maxLon: lon + (distance / (R * Math.cos(lat * Math.PI / 180)))
    };
  },

  formatCoord: (lat, lon, format = 'dms') => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    if (format === 'dms') {
      const formatDMS = (val, dir) => {
        const abs = Math.abs(val);
        const deg = Math.floor(abs);
        const min = Math.floor((abs - deg) * 60);
        const sec = ((abs - deg) * 60 - min) * 60;
        return `${deg}°${min}'${sec.toFixed(2)}"${dir}`;
      };
      return `${formatDMS(lat, latDir)} ${formatDMS(lon, lonDir)}`;
    }
    if (format === 'dm') {
      const formatDM = (val, dir) => {
        const abs = Math.abs(val);
        const deg = Math.floor(abs);
        const min = ((abs - deg) * 60);
        return `${deg}°${min.toFixed(4)}'${dir}`;
      };
      return `${formatDM(lat, latDir)} ${formatDM(lon, lonDir)}`;
    }
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  },

  geohash: (lat, lon, precision = 9) => {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180, hash = '', bit = 0, ch = 0;
    for (let i = 0; i < precision; i++) {
      for (let j = 0; j < 5; j++) {
        if (i % 2 === 0) {
          const mid = (minLon + maxLon) / 2;
          ch = ch * 2 + (lon > mid ? 1 : 0);
          lon > mid ? minLon = mid : maxLon = mid;
        } else {
          const mid = (minLat + maxLat) / 2;
          ch = ch * 2 + (lat > mid ? 1 : 0);
          lat > mid ? minLat = mid : maxLat = mid;
        }
        if (++bit === 5) { hash += base32[ch]; bit = 0; ch = 0; }
      }
    }
    return hash;
  }
};

export default { manifest, init, activate, deactivate, functions };
