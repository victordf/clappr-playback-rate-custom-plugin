import {Events, Styler, UICorePlugin, template} from 'clappr'
import pluginHtml from './public/playback-rate-selector.html'
import pluginStyle from './public/style.scss'

const DEFAULT_PLAYBACK_RATES = [
  {value: 0.5, label: '0.5x'},
  {value: 0.75, label: '0.75x'},
  {value: 1, label: 'Normal'},
  {value: 1.5, label: '1.5x'},
  {value: 2, label: '2x'}
]

const DEFAULT_MIN_PLAYBACKRATE_CUSTOM_RANGE = 0.5;
const DEFAULT_MAX_PLAYBACKRATE_CUSTOM_RANGE = 2;
const DEFAULT_STEP_PLAYBACKRATE_CUSTOM_RANGE = 0.1;
const DEFAULT_LABEL_PLAYBACKRATE_CUSTOM_RANGE = 'Custom';

const DEFAULT_PLAYBACK_RATE = 1
const DEFAULT_PLAYBACK_RATE_SUFFIX = 'x' // Used by getTitle method

export default class PlaybackRatePlugin extends UICorePlugin {
  get customPlaybackRate() { return null }
  get name() { return 'playback_rate' }
  get template() { return template(pluginHtml) }

  get attributes() {
    return {
      'class': this.name,
      'data-playback-rate-select': ''
    }
  }

  get events() {
    return {
      'click [data-playback-rate-select]': 'onRateSelect',
      'click [data-playback-rate-button]': 'onShowMenu',
      'click [data-custom-playbackrate-click]': 'onCustomSelect',
      'input [data-playback-rate-custom-change]': 'onCustomChange',
      'mousemove [data-playback-rate-custom-change]': 'onCustomMouseMove',
      'click [data-back-icon-slider]': 'onBack'
    }
  }

  get container() {
    return this.core.activeContainer
      ? this.core.activeContainer
      : this.core.mediaControl.container
  }

  get playback() {
    return this.core.activePlayback
      ? this.core.activePlayback
      : this.core.getCurrentPlayback()
  }

  bindEvents() {
    if (Events.CORE_ACTIVE_CONTAINER_CHANGED)
      this.listenTo(this.core, Events.CORE_ACTIVE_CONTAINER_CHANGED, this.reload)
    else
      this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_CONTAINERCHANGED, this.reload)

    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_RENDERED, this.render)
    // this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hideContextMenu)
    this.listenTo(this.core.mediaControl, Events.MEDIACONTROL_HIDE, this.hideMenus)
  }

  getExternalInterface() {
    return {
      getPlaybackRate: this.getSelectedRate,
      setPlaybackRate: this.setSelectedRate
    }
  }

  reload() {
    this.stopListening()
    this.bindEvents()
  }

  shouldRender() {
    return this.container && (
      this.playback.tagName === 'video'
      || this.playback.tagName === 'audio'
    )
  }

  render() {
    if (! this.shouldRender())
      return this

    const cfg = this.core.options.playbackRateConfig || {}
    this.playbackRates = cfg.options || DEFAULT_PLAYBACK_RATES
    this.selectedRate = cfg.defaultValue || DEFAULT_PLAYBACK_RATE
    this.rateSuffix = cfg.rateSuffix || DEFAULT_PLAYBACK_RATE_SUFFIX

    this.playbackCustomCallback = cfg.customRangeCallback || null;
    this.playbackCustomRangeLabel = this.selectedRate+'x'
    this.playbackCustomLabel = cfg.customRangeLabel || DEFAULT_LABEL_PLAYBACKRATE_CUSTOM_RANGE;
    this.playbackCustomRange = cfg.customRange || {
      min: cfg.playbackCustomRange && cfg.playbackCustomRange.min || DEFAULT_MIN_PLAYBACKRATE_CUSTOM_RANGE,
      max: cfg.playbackCustomRange && cfg.playbackCustomRange.max || DEFAULT_MAX_PLAYBACKRATE_CUSTOM_RANGE,
      step: cfg.playbackCustomRange && cfg.playbackCustomRange.step || DEFAULT_STEP_PLAYBACKRATE_CUSTOM_RANGE,
    }

    let t = template(pluginHtml)
    let html = t({
      playbackRates: this.playbackRates, 
      title: this.getTitle(), 
      customPlaybackRate: this.customPlaybackRate,
      playbackCustomLabel: this.playbackCustomLabel,
      playbackCustomRangeLabel: this.playbackCustomRangeLabel,
      playbackCustomRange: this.playbackCustomRange,
      selectedRate: this.selectedRate
    })
    this.$el.html(html)

    let style = Styler.getStyleFor(pluginStyle, {baseUrl: this.core.options.baseUrl})
    this.$el.append(style)

    this.core.mediaControl.$('.media-control-right-panel').append(this.el)
    this.updateText()
    this.loadCustomRangeStyle(this.selectedRate, this.playbackCustomRange.max);

    return this
  }

  onRateSelect(event) {
    event.stopPropagation()
    let rate = event.target.dataset.playbackRateSelect // data-playback-rate-select
    this.setSelectedRate(rate)
    this.toggleContextMenu()
    return false
  }

  onShowMenu() {
    this.hideCustomPlaybackrateSlider()
    this.toggleContextMenu()
  }

  onBack() {
    this.hideCustomPlaybackrateSlider()
    this.toggleContextMenu()
  }

  onCustomSelect() {
    this.toggleContextMenu()
    this.toggleCustomPlaybackrateSlider()
  }

  onCustomChange(event) {
    event.stopPropagation()
    let rate = event.target.value
    this.showCustomOption(rate)
    this.setSelectedRate(rate)
    if (this.playbackCustomCallback) {
      this.playbackCustomCallback(rate)
    }
    return false
  }

  onCustomMouseMove(e) {
    let slider = e.target;
    let valuePercent = (slider.value * 100) / slider.max;
    let color = `linear-gradient(90deg, rgb(255, 255, 255) ${valuePercent}%, rgb(117, 117, 117) ${valuePercent}%)`;
    slider.style.background = color;
  }

  loadCustomRangeStyle(value, max) {
    let valuePercent = (value * 100) / max;
    let color = `linear-gradient(90deg, rgb(255, 255, 255) ${valuePercent}%, rgb(117, 117, 117) ${valuePercent}%)`;
    let input = this.$('.playback_rate div.custom-playbackrate-slide ul li div.slideContainer input');
    input.selector[0].style.background = color
  }

  isCustom(playbackRate) {
    let rates = this.playbackRates.filter((pRate) => { 
      return this.toNumber(pRate.value) === this.toNumber(playbackRate) 
    })
    
    if (rates.length > 0) {
      return true
    }
    return false
  }

  showCustomOption(playbackRate) {
    if (this.isCustom(playbackRate)) {
      this.$('.playback_rate li.custom-playback-rate').hide()
    } else {
      this.$('.playback_rate ul li.custom-playback-rate a').text(playbackRate+'x')
      this.$('.playback_rate ul li.custom-playback-rate').show()
    }
  }

  toggleCustomPlaybackrateSlider() {
    this.$('.playback_rate div.custom-playbackrate-slide').toggle()
  }

  hideCustomPlaybackrateSlider() {
    this.$('.playback_rate div.custom-playbackrate-slide').hide()
  }

  toggleContextMenu() {
    this.$('.playback_rate ul.options-wrapper').toggle()
  }

  hideContextMenu() {
    this.$('.playback_rate ul.options-wrapper').hide()
  }

  hideMenus() {
    this.hideContextMenu();
    this.hideCustomPlaybackrateSlider();
  }

  toNumber(value) {
    value = Number(value)
    // Fallback to default playback rate if cannot be converted
    return isNaN(value) ? DEFAULT_PLAYBACK_RATE : value
  }

  setSelectedRate(rate) {
    rate = this.toNumber(rate)
    this.playback.el.playbackRate = rate
    this.selectedRate = rate
    this.updateText()
  }

  getSelectedRate() {
    return this.selectedRate
  }

  setActiveListItem(rateValue) {
    if (this.isCustom(rateValue)) {
      this.$('a').removeClass('active')
      this.$(`a[data-playback-rate-select="${rateValue}"]`).addClass('active')
    } else {
      this.$('a').removeClass('active')
      this.$(`a[data-playback-rate-select="custom"]`).addClass('active')
    }
  }

  buttonElement() {
    return this.$('.playback_rate button')
  }

  playbackRateCustomLabelElement() {
    return this.$('.playback_rate div.custom-playbackrate-slide label')
  }

  getTitle() {
    let rate = this.selectedRate

    for (const i in this.playbackRates) {
      if (this.playbackRates[i].value == rate)
        return this.playbackRates[i].label.replace('Personalizado(','').replace(')','')
    }

    // Unknown rate formatted title
    return rate + this.rateSuffix
  }

  updateText() {
    this.buttonElement().text(this.getTitle())
    this.playbackRateCustomLabelElement().text(this.selectedRate+'x')
    this.setActiveListItem(this.selectedRate)
  }
}
