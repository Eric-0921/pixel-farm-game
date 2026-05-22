let currentWeather = 'sunny'; // sunny | rainy | drought
let weatherDuration = 0;      // 当前天气已持续分钟数
let weatherTimer = null;      // setInterval 句柄
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
  }

  // 天气对土壤的影响
  try {
    const db = require('./database').getDatabase();
    if (currentWeather === 'rainy') {
      db.prepare("UPDATE plots SET soil_moisture = MIN(100, soil_moisture + 2) WHERE status = 'planted'").run();
    } else if (currentWeather === 'drought') {
      db.prepare("UPDATE plots SET soil_moisture = MAX(0, soil_moisture - 2) WHERE status = 'planted'").run();
    }
  } catch (e) {
    console.error('天气更新土壤失败:', e.message);
  }
}

function getWeather() { return { weather: currentWeather, duration: weatherDuration }; }

function startWeatherCycle() {
  if (!weatherTimer) {
    weatherTimer = setInterval(updateWeather, 60000);
    console.log('🌤️ 天气循环已启动');
  }
}

function stopWeatherCycle() {
  if (weatherTimer) {
    clearInterval(weatherTimer);
    weatherTimer = null;
    console.log('🌤️ 天气循环已停止');
  }
}

module.exports = { getWeather, updateWeather, startWeatherCycle, stopWeatherCycle };
