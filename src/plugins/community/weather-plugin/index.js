export const manifest = {
  name: 'weather-plugin',
  id: 'weather-plugin',
  version: '1.0.0',
  description: 'Weather information and forecasts',
  author: 'NEXUS',
  main: 'index.js',
  permissions: []
};

let api;
const cache = new Map();

export async function init(context) {
  api = context;
  api.log('Weather plugin initialized');
}

export async function activate(context) {
  api.log('Weather plugin activated');
}

export function deactivate() {
  api.log('Weather plugin deactivated');
}

export const hooks = {
  'agent:task:execute': async (task, context) => {
    if (task.type === 'weather') {
      return functions.getWeather(task.location);
    }
  }
};

export const functions = {
  getWeather: async (location) => {
    const cacheKey = `weather_${location}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 600000) {
      return { ...cached.data, cached: true };
    }

    const mockWeather = {
      location,
      temperature: Math.floor(Math.random() * 30) + 5,
      feelsLike: Math.floor(Math.random() * 30) + 5,
      humidity: Math.floor(Math.random() * 60) + 40,
      windSpeed: Math.floor(Math.random() * 30),
      condition: ['sunny', 'cloudy', 'partly_cloudy', 'rainy', 'stormy'][Math.floor(Math.random() * 5)],
      uvIndex: Math.floor(Math.random() * 11),
      visibility: Math.floor(Math.random() * 10) + 5,
      pressure: Math.floor(Math.random() * 50) + 990,
      timestamp: Date.now()
    };

    cache.set(cacheKey, { data: mockWeather, timestamp: Date.now() });
    return { ...mockWeather, cached: false };
  },
  getForecast: async (location, days = 7) => {
    const forecast = [];
    const baseTemp = Math.floor(Math.random() * 20) + 10;

    for (let i = 0; i < days; i++) {
      forecast.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        high: baseTemp + Math.floor(Math.random() * 10),
        low: baseTemp - Math.floor(Math.random() * 10),
        condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
        precipitation: Math.floor(Math.random() * 100),
        humidity: Math.floor(Math.random() * 60) + 40
      });
    }

    return { location, days, forecast };
  },
  getAirQuality: async (location) => {
    return {
      location,
      aqi: Math.floor(Math.random() * 200) + 1,
      category: ['Good', 'Moderate', 'Unhealthy for Sensitive', 'Unhealthy', 'Very Unhealthy', 'Hazardous'][Math.floor(Math.random() * 6)],
      pm25: Math.floor(Math.random() * 100),
      pm10: Math.floor(Math.random() * 100),
      o3: Math.floor(Math.random() * 100),
      no2: Math.floor(Math.random() * 100),
      timestamp: Date.now()
    };
  },
  getAlerts: async (location) => {
    return {
      location,
      alerts: [],
      count: 0,
      timestamp: Date.now()
    };
  },
  getHistorical: async (location, date) => {
    return {
      location,
      date,
      temperature: Math.floor(Math.random() * 30) + 5,
      precipitation: Math.floor(Math.random() * 50),
      conditions: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]
    };
  }
};

export default { manifest, init, activate, deactivate, hooks, functions };
