//"use strict"

//----------------------------------
// imports
//----------------------------------

/**
 * /usr/share/gjs-1.0/
 * /usr/share/gnome-js/
 */
const Cairo = imports.cairo
const Lang = imports.lang
// http://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html
const Mainloop = imports.mainloop

/**
 * /usr/share/gjs-1.0/overrides/
 * /usr/share/gir-1.0/
 * /usr/lib/cinnamon/
 */
const Gio = imports.gi.Gio
const Gtk = imports.gi.Gtk
const Json = imports.gi.Json
// http://developer.gnome.org/libsoup/stable/libsoup-client-howto.html
const Soup = imports.gi.Soup
// http://developer.gnome.org/st/stable/
const St = imports.gi.St

/**
 * /usr/share/cinnamon/js/
 */
const Applet = imports.ui.applet
const Config = imports.misc.config
const PopupMenu = imports.ui.popupMenu
const Settings = imports.ui.settings
const Util = imports.misc.util

//----------------------------------------------------------------------
//
// Constants
//
//----------------------------------------------------------------------

const UUID = "weather@mockturtl"
const APPLET_ICON = "view-refresh-symbolic"
const CMD_SETTINGS = "cinnamon-settings applets " + UUID
const WOEID_URL = "http://edg3.co.uk/snippets/weather-location-codes/"
const CMD_WOEID_LOOKUP = "xdg-open " + WOEID_URL

// Conversion Factors
const WEATHER_CONV_MPH_IN_MPS = 2.23693629
const WEATHER_CONV_KPH_IN_MPS = 3.6
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449

// Magic strings
const BLANK = '   '
const ELLIPSIS = '...'
const EN_DASH = '\u2013'

// Query
const QUERY_PARAMS = '?format=json&q=select '
const QUERY_TABLE = 'feednormalizer where url="http://xml.weather.yahoo.com/forecastrss/'
const QUERY_VIEW = '*'
const QUERY_URL = 'http://query.yahooapis.com/v1/public/yql' + QUERY_PARAMS + QUERY_VIEW + ' from ' + QUERY_TABLE


// Schema keys
const WEATHER_CITY_KEY = 'locationLabelOverride'
const WEATHER_REFRESH_INTERVAL = 'refreshInterval'
const WEATHER_SHOW_COMMENT_IN_PANEL_KEY = 'showCommentInPanel'
const WEATHER_SHOW_SUNRISE_KEY = 'showSunrise'
const WEATHER_SHOW_WIND_CHILL_KEY = 'showWindChill'
const WEATHER_SHOW_FIVEDAY_FORECAST_KEY = 'showFivedayForecast'
const WEATHER_SHOW_TEXT_IN_PANEL_KEY = 'showTextInPanel'
const WEATHER_translateCondition_KEY = 'translateCondition'
const WEATHER_TEMPERATURE_UNIT_KEY = 'temperatureUnit'
const WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons'
const WEATHER_WIND_SPEED_UNIT_KEY = 'windSpeedUnit'
const WEATHER_WOEID_KEY = 'woeid'

const KEYS = [
  WEATHER_TEMPERATURE_UNIT_KEY,
  WEATHER_WIND_SPEED_UNIT_KEY,
  WEATHER_CITY_KEY,
  WEATHER_WOEID_KEY,
  WEATHER_translateCondition_KEY,
  WEATHER_SHOW_TEXT_IN_PANEL_KEY,
  WEATHER_SHOW_COMMENT_IN_PANEL_KEY,
  WEATHER_SHOW_SUNRISE_KEY,
  WEATHER_SHOW_WIND_CHILL_KEY,
  WEATHER_SHOW_FIVEDAY_FORECAST_KEY,
  WEATHER_REFRESH_INTERVAL
]

// Signals
const SIGNAL_CHANGED = 'changed::'
const SIGNAL_CLICKED = 'clicked'
const SIGNAL_REPAINT = 'repaint'

// stylesheet.css
const STYLE_LOCATION_LINK = 'weather-current-location-link'
const STYLE_SUMMARYBOX = 'weather-current-summarybox'
const STYLE_SUMMARY = 'weather-current-summary'
const STYLE_DATABOX = 'weather-current-databox'
const STYLE_ICON = 'weather-current-icon'
const STYLE_ICONBOX = 'weather-current-iconbox'
const STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions'
const STYLE_ASTRONOMY = 'weather-current-astronomy'
const STYLE_FORECAST_ICON = 'weather-forecast-icon'
const STYLE_FORECAST_DATABOX = 'weather-forecast-databox'
const STYLE_FORECAST_DAY = 'weather-forecast-day'
const STYLE_CONFIG = 'weather-config'
const STYLE_DATABOX_VALUES = 'weather-current-databox-values'
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary'
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature'
const STYLE_FORECAST_BOX = 'weather-forecast-box'
const STYLE_PANEL_BUTTON = 'panel-button'
const STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item'
const STYLE_CURRENT = 'current'
const STYLE_FORECAST = 'forecast'

const WeatherUnits = {
  CELSIUS: 'celsius',
  FAHRENHEIT: 'fahrenheit'
}

const WeatherWindSpeedUnits = {
  KPH: 'kph',
  MPH: 'mph',
  MPS: 'm/s',
  KNOTS: 'knots'
}

//----------------------------------------------------------------------
//
// Soup
//
//----------------------------------------------------------------------

// Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)
const _httpSession = new Soup.SessionAsync()
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault())


//----------------------------------------------------------------------
//
// Logging
//
//----------------------------------------------------------------------

function log(message) {
  global.log(UUID + "#" + log.caller.name + ": " + message)
}

function logError(error) {
  global.logError(UUID + "#" + logError.caller.name + ": " + error)
}

//----------------------------------------------------------------
//
// l10n
//
//----------------------------------------------------------------------

const GLib = imports.gi.GLib
const Gettext = imports.gettext
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str)
}


//----------------------------------------------------------------------
//
// MyApplet
//
//----------------------------------------------------------------------

function MyApplet(metadata, orientation, panelHeight, instanceId) {
  this.settings = new Settings.AppletSettings(this, UUID, instanceId)
  this._init(orientation, panelHeight, instanceId)
}

MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype

, refreshAndRebuild: function refreshAndRebuild() {
    this.refreshWeather(false)
    this.rebuild()
  }

, dumpKeys: function dumpKeys() {
    for (let k in KEYS) {
      let key = KEYS[k]
      let keyProp = "_" + key
      log(keyProp + "=" + this[keyProp])
    }
  }

, woeidLookup: function() {
    Util.spawnCommandLine(CMD_WOEID_LOOKUP)
  }

    // Override Methods: TextIconApplet
, _init: function _init(orientation, panelHeight, instanceId) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId)
      
      // Interface: TextIconApplet
      this.set_applet_icon_name(APPLET_ICON)
      this.set_applet_label(_("..."))
      this.set_applet_tooltip(_("Click to open"))
      
      // PopupMenu
      this.menuManager = new PopupMenu.PopupMenuManager(this)
      this.menu = new Applet.AppletPopupMenu(this, orientation)
      this.menuManager.addMenu(this.menu)

      //----------------------------------
      // bind settings
      //----------------------------------

      for (let k in KEYS) {
        let key = KEYS[k]
        let keyProp = "_" + key
        this.settings.bindProperty(Settings.BindingDirection.IN, key, keyProp,
                                   this.refreshAndRebuild, null)
      }
      //log("bound settings")

      this.updateIconType()

      this.settings.connect(SIGNAL_CHANGED + WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, function() {
        this.updateIconType()
        this._applet_icon.icon_type = this._icon_type
        this._currentWeatherIcon.icon_type = this._icon_type
        let daysToShow = this._showFivedayForecast ? 5 : 2
        for (let i = 0; i < daysToShow; i++) {
          this._forecast[i].Icon.icon_type = this._icon_type
        }
        this.refreshWeather(false)
      }))
 
      // configuration via context menu is automatically provided in Cinnamon 2.0+
      let cinnamonVersion = Config.PACKAGE_VERSION.split('.')
      let majorVersion = parseInt(cinnamonVersion[0])
      //log("cinnamonVersion=" + cinnamonVersion +  "; majorVersion=" + majorVersion)

      // for Cinnamon 1.x, build a menu item
      if (majorVersion < 2) {
        let itemLabel = _("Settings")
        let settingsMenuItem = new Applet.MenuItem(itemLabel, Gtk.STOCK_EDIT, Lang.bind(this, function() {
            Util.spawnCommandLine(CMD_SETTINGS)
        }))
        this._applet_context_menu.addMenuItem(settingsMenuItem)
      }

      //------------------------------
      // render graphics container
      //------------------------------

      // build menu
      let mainBox = new St.BoxLayout({ vertical: true })
      this.menu.addActor(mainBox)

      //  today's forecast
      this._currentWeather = new St.Bin({ style_class: STYLE_CURRENT })
      mainBox.add_actor(this._currentWeather)

      //  horizontal rule
      this._separatorArea = new St.DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM })
      this._separatorArea.width = 200
      this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint))
      mainBox.add_actor(this._separatorArea)

      //  tomorrow's forecast
      this._futureWeather = new St.Bin({ style_class: STYLE_FORECAST })
      mainBox.add_actor(this._futureWeather)

      this.rebuild()

      //------------------------------
      // run
      //------------------------------
      Mainloop.timeout_add_seconds(3, Lang.bind(this, function mainloopTimeout() {
        this.refreshWeather(true)
      }))
   }

  // Override Methods: Applet
, on_applet_clicked: function on_applet_clicked(event) {
    this.menu.toggle()
  }

, _onSeparatorAreaRepaint: function onSeparatorAreaRepaint(area) {
    let cr = area.get_context()
    let themeNode = area.get_theme_node()
    let [width, height] = area.get_surface_size()
    let margin = themeNode.get_length('-margin-horizontal')
    let gradientHeight = themeNode.get_length('-gradient-height')
    let startColor = themeNode.get_color('-gradient-start')
    let endColor = themeNode.get_color('-gradient-end')
    let gradientWidth = (width - margin * 2)
    let gradientOffset = (height - gradientHeight) / 2
    let pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight)

    pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255)
    pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255)
    pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255)
    cr.setSource(pattern)
    cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight)
    cr.fill()
  }

  //----------------------------------------------------------------------
  //
  // Methods
  //
  //----------------------------------------------------------------------

, updateIconType: function updateIconType() {
    this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ? 
                        St.IconType.SYMBOLIC : 
                        St.IconType.FULLCOLOR
  }

, loadJsonAsync: function loadJsonAsync(url, callback) {
    let context = this
    let message = Soup.Message.new('GET', url)
    _httpSession.queue_message(message, function soupQueue(session, message) {
      let jp = new Json.Parser()
      jp.load_from_data(message.response_body.data, -1)
      callback.call(context, jp.get_root().get_object())
    })
  }

, parseDay: function(abr) {
    let yahoo_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (let i = 0; i < yahoo_days.length; i++) {
      if (yahoo_days[i].substr(0, abr.length) == abr.toLowerCase()) {
        return i
      }
    }
    return 0
  }

, refreshWeather: function refreshWeather(recurse) {
    //log("recurse=" + recurse)
    //this.dumpKeys()
    this.loadJsonAsync(this.weatherUrl(), function(json) {
      try {
        let weather = json.get_object_member('query').get_object_member('results').get_object_member('rss').get_object_member('channel')
        let weather_c = weather.get_object_member('item').get_object_member('condition')
        let forecast = weather.get_object_member('item').get_array_member('forecast').get_elements()

        let location = weather.get_object_member('location').get_string_member('city')
        if (this._city != null && this._city.length > 0)
          location = this._city

        // Refresh current weather
        let comment = weather_c.get_string_member('text')
        if (this._translateCondition)
          comment = this.weatherCondition(weather_c.get_string_member('code'))

        let humidity = weather.get_object_member('atmosphere').get_string_member('humidity') + ' %'

        let pressure = weather.get_object_member('atmosphere').get_string_member('pressure')
        let pressure_unit = weather.get_object_member('units').get_string_member('pressure')

        let sunrise = weather.get_object_member('astronomy').get_string_member('sunrise')
        let sunset = weather.get_object_member('astronomy').get_string_member('sunset')

        let temperature = weather_c.get_string_member('temp')

        let wind = weather.get_object_member('wind').get_string_member('speed')
        let wind_chill = weather.get_object_member('wind').get_string_member('chill')
        let wind_direction = this.compassDirection(weather.get_object_member('wind').get_string_member('direction'))
        let wind_unit = weather.get_object_member('units').get_string_member('speed')

        let iconname = this.weatherIconSafely(weather_c.get_string_member('code'))
        this._currentWeatherIcon.icon_name = iconname
        this._icon_type == St.IconType.SYMBOLIC ?
          this.set_applet_icon_symbolic_name(iconname) :
          this.set_applet_icon_name(iconname)

        if (this._showTextInPanel) {
          if (this._showCommentInPanel) {
            this.set_applet_label(comment + ' ' + temperature + ' ' + this.unitToUnicode())
          } else {
            this.set_applet_label(temperature + ' ' + this.unitToUnicode())
          }
        } else {
          this.set_applet_label('')
        }

        this._currentWeatherSummary.text = comment
        this._currentWeatherTemperature.text = temperature + ' ' + this.unitToUnicode()
        this._currentWeatherWindChill.text = this._showWindChill ? (wind_chill + ' ' + this.unitToUnicode()) : ''
        this._currentWeatherHumidity.text = humidity
        this._currentWeatherPressure.text = pressure + ' ' + pressure_unit

        // Override wind units with our preference
        // Need to consider what units the Yahoo API has returned it in
        switch (this._windSpeedUnit) {
          case WeatherWindSpeedUnits.KPH:
            // Round to whole units
            if (this._temperatureUnit == WeatherUnits.FAHRENHEIT) {
              wind = Math.round (wind / WEATHER_CONV_MPH_IN_MPS * WEATHER_CONV_KPH_IN_MPS)
              wind_unit = 'km/h'
            }
            // Otherwise no conversion needed - already in correct units
            break
          case WeatherWindSpeedUnits.MPH:
            // Round to whole units
            if (this._temperatureUnit == WeatherUnits.CELSIUS) {
              wind = Math.round (wind / WEATHER_CONV_KPH_IN_MPS * WEATHER_CONV_MPH_IN_MPS)
              wind_unit = 'mph'
            }
            // Otherwise no conversion needed - already in correct units
            break
          case WeatherWindSpeedUnits.MPS:
            // Precision to one decimal place as 1 m/s is quite a large unit
            if (this._temperatureUnit == WeatherUnits.CELSIUS) {
              wind = Math.round ((wind / WEATHER_CONV_KPH_IN_MPS) * 10)/ 10
            } else {
              wind = Math.round ((wind / WEATHER_CONV_MPH_IN_MPS) * 10)/ 10
            }
            wind_unit = 'm/s'
            break
          case WeatherWindSpeedUnits.KNOTS:
            // Round to whole units
            if (this._temperatureUnit == WeatherUnits.CELSIUS)
              wind = Math.round (wind / WEATHER_CONV_KPH_IN_MPS * WEATHER_CONV_KNOTS_IN_MPS)
            else
              wind = Math.round (wind / WEATHER_CONV_MPH_IN_MPS * WEATHER_CONV_KNOTS_IN_MPS)
            wind_unit = 'knots'
            break
        }
        this._currentWeatherWind.text = (wind_direction ? wind_direction + ' ' : '') + wind + ' ' + wind_unit

        // location is a button
        this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK
        this._currentWeatherLocation.url = weather.get_string_member('link')
        this._currentWeatherLocation.label = _(location)

        // gettext can't see these inline
        let sunriseText = _('Sunrise')
        let sunsetText = _('Sunset')
        this._currentWeatherSunrise.text = this._showSunrise ? (sunriseText + ': ' + sunrise) : ''
        this._currentWeatherSunset.text = this._showSunrise ? (sunsetText + ': ' + sunset) : ''

        // Refresh forecast
        // let date_string = [_('Today'), _('Tomorrow')]
        let daysToShow = this._showFivedayForecast ? 5 : 2
        for (let i = 0; i < daysToShow; i++) {
          let forecastUi = this._forecast[i]
          let forecastData = forecast[i].get_object()

          let code = forecastData.get_string_member('code')
          let t_low = forecastData.get_string_member('low')
          let t_high = forecastData.get_string_member('high')

          let comment = forecastData.get_string_member('text')
          if (this._translateCondition)
            comment = this.weatherCondition(code)

          forecastUi.Day.text = this.localeDay(forecastData.get_string_member('day'))
          forecastUi.Temperature.text = t_low + ' ' + '\u002F' + ' ' + t_high + ' ' + this.unitToUnicode()
          forecastUi.Summary.text = comment
          forecastUi.Icon.icon_name = this.weatherIconSafely(code)
        }
      } catch(error) {
        logError(error)
      }
    })

    if (recurse) {
      Mainloop.timeout_add_seconds(this._refreshInterval * 60, Lang.bind(this, function() {
        this.refreshWeather(true)
      }))
    }
  }

, destroyCurrentWeather: function destroyCurrentWeather() {
    if (this._currentWeather.get_child() != null)
      this._currentWeather.get_child().destroy()
  }

, destroyFutureWeather: function destroyFutureWeather() {
    if (this._futureWeather.get_child() != null)
      this._futureWeather.get_child().destroy()
  }

, showLoadingUi: function showLoadingUi() {
    this.destroyCurrentWeather()
    this.destroyFutureWeather()
    this._currentWeather.set_child(new St.Label({ text: _('Loading current weather ...') }))
    this._futureWeather.set_child(new St.Label({ text: _('Loading future weather ...') }))
  }

, rebuild: function rebuild() {
    this.showLoadingUi()
    this.rebuildCurrentWeatherUi()
    this.rebuildFutureWeatherUi()
  }

, rebuildCurrentWeatherUi: function rebuildCurrentWeatherUi() {
    this.destroyCurrentWeather()

    // This will hold the icon for the current weather
    this._currentWeatherIcon = new St.Icon({
      icon_type: this._icon_type,
      icon_size: 64,
      icon_name: APPLET_ICON,
      style_class: STYLE_ICON
    })

    // The summary of the current weather
    this._currentWeatherSummary = new St.Label({
      text: _('Loading ...'),
      style_class: STYLE_SUMMARY
    })

    this._currentWeatherLocation = new St.Button({
      reactive: true,
      label: _('Please wait')
    })

    // link to the details page
    this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function() {
      if (this._currentWeatherLocation.url == null)
        return
      Gio.app_info_launch_default_for_uri(
        this._currentWeatherLocation.url,
        global.create_app_launch_context()
      )
    }))

    let bb = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_SUMMARYBOX
    })
    bb.add_actor(this._currentWeatherLocation)
    bb.add_actor(this._currentWeatherSummary)


    let textOb = { text: ELLIPSIS }
    this._currentWeatherSunrise = new St.Label(textOb)
    this._currentWeatherSunset = new St.Label(textOb)

    let ab = new St.BoxLayout({
      style_class: STYLE_ASTRONOMY
    })

    ab.add_actor(this._currentWeatherSunrise)
    let ab_spacerlabel = new St.Label({ text: BLANK })
    ab.add_actor(ab_spacerlabel)
    ab.add_actor(this._currentWeatherSunset)

    let bb_spacerlabel = new St.Label({ text: BLANK })
    bb.add_actor(bb_spacerlabel)
    bb.add_actor(ab)

    // Other labels
    this._currentWeatherTemperature = new St.Label(textOb)
    this._currentWeatherWindChill = new St.Label(textOb)
    this._currentWeatherHumidity = new St.Label(textOb)
    this._currentWeatherPressure = new St.Label(textOb)
    this._currentWeatherWind = new St.Label(textOb)

    let rb = new St.BoxLayout({
      style_class: STYLE_DATABOX
    })
    let rb_captions = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_DATABOX_CAPTIONS
    })
    let rb_values = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_DATABOX_VALUES
    })
    rb.add_actor(rb_captions)
    rb.add_actor(rb_values)

    rb_captions.add_actor(new St.Label({text: _('Temperature:')}))
    rb_values.add_actor(this._currentWeatherTemperature)
    if (this._showWindChill) {
      rb_captions.add_actor(new St.Label({text: _('Feels Like:')}))
      rb_values.add_actor(this._currentWeatherWindChill)
    }
    rb_captions.add_actor(new St.Label({text: _('Humidity:')}))
    rb_values.add_actor(this._currentWeatherHumidity)
    rb_captions.add_actor(new St.Label({text: _('Pressure:')}))
    rb_values.add_actor(this._currentWeatherPressure)
    rb_captions.add_actor(new St.Label({text: _('Wind:')}))
    rb_values.add_actor(this._currentWeatherWind)

    let xb = new St.BoxLayout()
    xb.add_actor(bb)
    xb.add_actor(rb)

    let box = new St.BoxLayout({
      style_class: STYLE_ICONBOX
    })
    box.add_actor(this._currentWeatherIcon)
    box.add_actor(xb)
    this._currentWeather.set_child(box)
  }

, rebuildFutureWeatherUi: function rebuildFutureWeatherUi() {
    this.destroyFutureWeather()

    this._forecast = []
    this._forecastBox = new St.BoxLayout()
    this._futureWeather.set_child(this._forecastBox)

    let daysToShow = this._showFivedayForecast ? 5 : 2
    for (let i = 0; i < daysToShow; i++) {
      let forecastWeather = {}

      forecastWeather.Icon = new St.Icon({
        icon_type: this._icon_type,
        icon_size: 48,
        icon_name: APPLET_ICON,
        style_class: STYLE_FORECAST_ICON
      })
      forecastWeather.Day = new St.Label({
        style_class: STYLE_FORECAST_DAY
      })
      forecastWeather.Summary = new St.Label({
        style_class: STYLE_FORECAST_SUMMARY
      })
      forecastWeather.Temperature = new St.Label({
        style_class: STYLE_FORECAST_TEMPERATURE
      })

      let by = new St.BoxLayout({
        vertical: true,
        style_class: STYLE_FORECAST_DATABOX
      })
      by.add_actor(forecastWeather.Day)
      by.add_actor(forecastWeather.Summary)
      by.add_actor(forecastWeather.Temperature)

      let bb = new St.BoxLayout({
        style_class: STYLE_FORECAST_BOX
      })
      bb.add_actor(forecastWeather.Icon)
      bb.add_actor(by)

      this._forecast[i] = forecastWeather
      this._forecastBox.add_actor(bb)
    }
  }

  //----------------------------------------------------------------------
  //
  // Properties
  //
  //----------------------------------------------------------------------

, unitToUrl: function() {
    return this._temperatureUnit == WeatherUnits.FAHRENHEIT ? 'f' : 'c'
  }

, unitToUnicode: function() {
    return this._temperatureUnit == WeatherUnits.FAHRENHEIT ? '\u2109' : '\u2103'
  }

, weatherUrl: function weatherUrl() {
    //let output = QUERY_URL + ' where location="' + this._woeid + '" and u="' + this.unitToUrl() + '"'
    let output = QUERY_URL + this._woeid + '_' + this.unitToUrl() + '.xml"' 
    return output
  }

, weatherIcon: function(code) {
    /* see http://developer.yahoo.com/weather/#codetable */
    /* fallback icons are: weather-clear-night weather-clear weather-few-clouds-night weather-few-clouds weather-fog weather-overcast weather-severe-alert weather-showers weather-showers-scattered weather-snow weather-storm */
    switch (parseInt(code, 10)) {
      case 0:/* tornado */
        return ['weather-severe-alert']
      case 1:/* tropical storm */
        return ['weather-severe-alert']
      case 2:/* hurricane */
        return ['weather-severe-alert']
      case 3:/* severe thunderstorms */
        return ['weather-severe-alert']
      case 4:/* thunderstorms */
        return ['weather-storm']
      case 5:/* mixed rain and snow */
        return ['weather-snow-rain', 'weather-snow']
      case 6:/* mixed rain and sleet */
        return ['weather-snow-rain', 'weather-snow']
      case 7:/* mixed snow and sleet */
        return ['weather-snow']
      case 8:/* freezing drizzle */
        return ['weather-freezing-rain', 'weather-showers']
      case 9:/* drizzle */
        return ['weather-fog']
      case 10:/* freezing rain */
        return ['weather-freezing-rain', 'weather-showers']
      case 11:/* showers */
        return ['weather-showers']
      case 12:/* showers */
        return ['weather-showers']
      case 13:/* snow flurries */
        return ['weather-snow']
      case 14:/* light snow showers */
        return ['weather-snow']
      case 15:/* blowing snow */
        return ['weather-snow']
      case 16:/* snow */
        return ['weather-snow']
      case 17:/* hail */
        return ['weather-snow']
      case 18:/* sleet */
        return ['weather-snow']
      case 19:/* dust */
        return ['weather-fog']
      case 20:/* foggy */
        return ['weather-fog']
      case 21:/* haze */
        return ['weather-fog']
      case 22:/* smoky */
        return ['weather-fog']
      case 23:/* blustery */
        return ['weather-few-clouds']
      case 24:/* windy */
        return ['weather-few-clouds']
      case 25:/* cold */
        return ['weather-few-clouds']
      case 26:/* cloudy */
        return ['weather-overcast']
      case 27:/* mostly cloudy (night) */
        return ['weather-clouds-night', 'weather-few-clouds-night']
      case 28:/* mostly cloudy (day) */
        return ['weather-clouds', 'weather-overcast']
      case 29:/* partly cloudy (night) */
        return ['weather-few-clouds-night']
      case 30:/* partly cloudy (day) */
        return ['weather-few-clouds']
      case 31:/* clear (night) */
        return ['weather-clear-night']
      case 32:/* sunny */
        return ['weather-clear']
      case 33:/* fair (night) */
        return ['weather-clear-night']
      case 34:/* fair (day) */
        return ['weather-clear']
      case 35:/* mixed rain and hail */
        return ['weather-snow-rain', 'weather-showers']
      case 36:/* hot */
        return ['weather-clear']
      case 37:/* isolated thunderstorms */
        return ['weather-storm']
      case 38:/* scattered thunderstorms */
        return ['weather-storm']
      case 39:/* http://developer.yahoo.com/forum/YDN-Documentation/Yahoo-Weather-API-Wrong-Condition-Code/1290534174000-1122fc3d-da6d-34a2-9fb9-d0863e6c5bc6 */
      case 40:/* scattered showers */
        return ['weather-showers-scattered', 'weather-showers']
      case 41:/* heavy snow */
        return ['weather-snow']
      case 42:/* scattered snow showers */
        return ['weather-snow']
      case 43:/* heavy snow */
        return ['weather-snow']
      case 44:/* partly cloudy */
        return ['weather-few-clouds']
      case 45:/* thundershowers */
        return ['weather-storm']
      case 46:/* snow showers */
        return ['weather-snow']
      case 47:/* isolated thundershowers */
        return ['weather-storm']
      case 3200:/* not available */
      default:
        return ['weather-severe-alert']
    }
  }

, weatherIconSafely: function(code) {
    let iconname = this.weatherIcon(code)
    for (let i = 0; i < iconname.length; i++) {
      if (this.hasIcon(iconname[i]))
        return iconname[i]
    }
    return 'weather-severe-alert'
  }

, hasIcon: function(icon) {
    return Gtk.IconTheme.get_default().has_icon(icon + (this._icon_type == St.IconType.SYMBOLIC ? '-symbolic' : ''))
  }

, weatherCondition: function(code) {
    switch (parseInt(code, 10)){
      case 0:/* tornado */
        return _('Tornado')
      case 1:/* tropical storm */
        return _('Tropical storm')
      case 2:/* hurricane */
        return _('Hurricane')
      case 3:/* severe thunderstorms */
        return _('Severe thunderstorms')
      case 4:/* thunderstorms */
        return _('Thunderstorms')
      case 5:/* mixed rain and snow */
        return _('Mixed rain and snow')
      case 6:/* mixed rain and sleet */
        return _('Mixed rain and sleet')
      case 7:/* mixed snow and sleet */
        return _('Mixed snow and sleet')
      case 8:/* freezing drizzle */
        return _('Freezing drizzle')
      case 9:/* drizzle */
        return _('Drizzle')
      case 10:/* freezing rain */
        return _('Freezing rain')
      case 11:/* showers */
        return _('Showers')
      case 12:/* showers */
        return _('Showers')
      case 13:/* snow flurries */
        return _('Snow flurries')
      case 14:/* light snow showers */
        return _('Light snow showers')
      case 15:/* blowing snow */
        return _('Blowing snow')
      case 16:/* snow */
        return _('Snow')
      case 17:/* hail */
        return _('Hail')
      case 18:/* sleet */
        return _('Sleet')
      case 19:/* dust */
        return _('Dust')
      case 20:/* foggy */
        return _('Foggy')
      case 21:/* haze */
        return _('Haze')
      case 22:/* smoky */
        return _('Smoky')
      case 23:/* blustery */
        return _('Blustery')
      case 24:/* windy */
        return _('Windy')
      case 25:/* cold */
        return _('Cold')
      case 26:/* cloudy */
        return _('Cloudy')
      case 27:/* mostly cloudy (night) */
      case 28:/* mostly cloudy (day) */
        return _('Mostly cloudy')
      case 29:/* partly cloudy (night) */
      case 30:/* partly cloudy (day) */
        return _('Partly cloudy')
      case 31:/* clear (night) */
        return _('Clear')
      case 32:/* sunny */
        return _('Sunny')
      case 33:/* fair (night) */
      case 34:/* fair (day) */
        return _('Fair')
      case 35:/* mixed rain and hail */
        return _('Mixed rain and hail')
      case 36:/* hot */
        return _('Hot')
      case 37:/* isolated thunderstorms */
        return _('Isolated thunderstorms')
      case 38:/* scattered thunderstorms */
      case 39:/* scattered thunderstorms */
        return _('Scattered thunderstorms')
      case 40:/* scattered showers */
        return _('Scattered showers')
      case 41:/* heavy snow */
        return _('Heavy snow')
      case 42:/* scattered snow showers */
        return _('Scattered snow showers')
      case 43:/* heavy snow */
        return _('Heavy snow')
      case 44:/* partly cloudy */
        return _('Partly cloudy')
      case 45:/* thundershowers */
        return _('Thundershowers')
      case 46:/* snow showers */
        return _('Snow showers')
      case 47:/* isolated thundershowers */
        return _('Isolated thundershowers')
      case 3200:/* not available */
      default:
        return _('Not available')
    }
  }

, localeDay: function(abr) {
    let days = [_('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday'), _('Sunday')]
    return days[this.parseDay(abr)]
  }

, compassDirection: function(deg) {
    let directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')]
    return directions[Math.round(deg / 45) % directions.length]
  }
}

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata, orientation, panelHeight, instanceId) {
  //log("v" + metadata.version + ", cinnamon " + Config.PACKAGE_VERSION)
  return new MyApplet(metadata, orientation, panelHeight, instanceId)
}
