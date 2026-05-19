/**
 * 语音播报管理器（老年人专属）
 */
class VoiceManager {
  constructor() {
    this.enabled = localStorage.getItem('farm_voice') === 'true';
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.init();
  }

  init() {
    if (!this.synth) {
      console.warn('当前浏览器不支持语音合成');
      return;
    }
    // 加载语音列表
    this.loadVoices();
    // 某些浏览器语音列表是异步加载的
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    this.voices = this.synth ? this.synth.getVoices() : [];
  }

  /**
   * 播报消息
   * @param {string} text — 要播报的文本
   */
  speak(text) {
    if (!this.enabled || !this.synth) return;
    // 取消当前播报，避免队列堆积
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9; // 稍慢，适合老年人
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    // 尝试使用中文语音
    const chineseVoice = this.voices.find(v => v.lang && v.lang.includes('zh'));
    if (chineseVoice) utterance.voice = chineseVoice;
    this.synth.speak(utterance);
  }

  /**
   * 作物成熟播报
   * @param {string} cropName — 作物名称
   */
  speakCropMature(cropName) {
    this.speak(`您的${cropName}已成熟，快来收获吧！`);
  }

  /**
   * 操作成功播报
   * @param {string} action — 操作描述
   */
  speakSuccess(action) {
    this.speak(`${action}成功！`);
  }

  /**
   * 切换语音播报开关
   * @returns {boolean} 切换后的状态
   */
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('farm_voice', this.enabled);
    return this.enabled;
  }

  /**
   * 设置开关状态
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('farm_voice', this.enabled);
  }
}

// 全局实例
const voiceManager = new VoiceManager();
