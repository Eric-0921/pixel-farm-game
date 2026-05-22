let currentWeather = 'sunny'; // sunny | rainy | drought
let weatherDuration = 0;      // 当前天气已持续分钟数
const WEATHER_CYCLE = 30;     // 每30分钟切换一次

function updateWeather() {
  weatherDuration++;
  if (weatherDuration >= WEATHER_CYCLE) {
    weatherDuration = 0;
    const roll = Math.random();
    if (roll < 0.5) currentWeather = 'sunny';
    else if (roll < 0.8) currentWeather = 'rainy';
    else currentWeather = 'drought';
    console.log(`🌤️ 天气变化: ${currentWeather}`);
    // 广播天气变化（通过 websocket，但先只提供 getWeather 函数）
  }

  // 天气对土壤的影响
  const db = require('./database').getDatabase();
  if (currentWeather === 'rainy') {
    db.prepare("UPDATE plots SET soil_moisture = MIN(100, soil_moisture + 2) WHERE status = 'planted'").run();
  } else if (currentWeather === 'drought') {
    db.prepare("UPDATE plots SET soil_moisture = MAX(0, soil_moisture - 2) WHERE status = 'planted'").run();
  }
}

function getWeather() { return { weather: currentWeather, duration: weatherDuration }; }

// 每分钟执行一次
setInterval(updateWeather, 60000);

module.exports = { getWeather, updateWeather };
