/**
 * Created with IntelliJ IDEA.
 * User: bjeong
 * Date: 9/21/13
 * Time: 11:35 PM
 * To change this template use File | Settings | File Templates.
 */

// ds is the name space
var ds = (function() {
        var drops = (function() {
        const defaultValue = 1;
        const titleFormatter = "how many drops: <span style='font-weight: bold; color: blue'><i>%s</i></span>";

        var currentValue = defaultValue;

        function getLabel(value) {
            if (value == 0) {
                return "none";
            }
            return sprintf("%d", value);
        }

        return {
            getTitleHtml: function() {
                return sprintf(titleFormatter, getLabel(currentValue));
            },

            setValue: function(value) {
                currentValue = value;
            },

            getValue: function() {
                return currentValue;
            }
        }
    })();


    var photo = (function() {
        const defaultValue = false;
        const titleFormatter = "take photo?: <span style='font-weight: bold; color: blue'><i>%s</i></span>";

        var currentValue = defaultValue;

        return {
            getTitleHtml: function() {
                return sprintf(titleFormatter, currentValue ? "yes" : "no");
            },

            setValue: function(value) {
                currentValue = value != "0";
            },

            getValue: function() {
                return currentValue;
            },

            getStringValue: function() {
                return currentValue ? "1" : "0";
            }
        }
    })();


    var envread = (function() {
        const defaultValue = true;
        const titleFormatter = "read temperature & moisture?: <span style='font-weight: bold; color: blue'><i>%s</i></span>";

        var currentValue = defaultValue;

        return {
            getTitleHtml: function() {
                return sprintf(titleFormatter, currentValue ? "yes" : "no");
            },

            setValue: function(value) {
                currentValue = value != "0";
            },

            getValue: function() {
                return currentValue;
            },

            getStringValue: function() {
                return currentValue ? "1" : "0";
            }
        }
    })();


    var runs = (function() {
        const defaultValue = 1;
        const titleFormatter = "run <span style='font-weight: bold; color: blue'><i>%s</i></span>";

        var currentValue = defaultValue;

        function getLabel(value) {
            if (value == 1) {
                return "once";
            }
            return sprintf("%d times", value);
        }

        return {
            getTitleHtml: function() {
                return sprintf(titleFormatter, getLabel(currentValue));
            },

            setValue: function(value) {
                currentValue = value;
            },

            getValue: function() {
                return currentValue;
            }
        }
    })();


    var interval = (function() {
        // unit values are s, m, h, d for second, minute, hour and day
        const defaultValue = 1;
        const defaultUnit = "d";
        const titleFormatter = "with the interval of <span style='font-weight: bold; color: blue'><i>%d %s</i></span>";

        var currentValue = defaultValue;
        var currentUnit = defaultUnit;

        function getUnitLabel(value, unit) {
            switch (unit) {
                case 's':
                    return value == 1 ? "second" : "seconds";
                case 'm':
                    return value == 1 ? "minute" : "minutes";
                case 'h':
                    return value == 1 ? "hour" : "hours";
                case 'd':
                    return value == 1 ? "day" : "days";
                default:
                    return "Unknown"
            }
        }
        return {
            getTitleHtml: function() {
                return sprintf(titleFormatter, currentValue, getUnitLabel(currentValue, currentUnit));
            },

            getValue: function() {
                return currentValue;
            },

            setValue: function(value) {
                currentValue = value;
            },

            getUnit: function() {
                return currentUnit;
            },

            setUnit: function(unit) {
                currentUnit = unit;
            }
        }
    })();


    var start = (function() {
        const defaultNowValue = true;
        const titleFormatter = "starting%s<span style='font-weight: bold; color: blue'><i>%s</i></span>";

        var currentNowValue = defaultNowValue;
        var time = squirtCommon.getMilliSinceEpoch() + 60*60*1000;  // one hour later by default
        time = squirtCommon.getMilliSinceEpoch() + 30*1000;  // shorter delay for debug
        var dateString = 0;
        var timeString = 0;

        function getLabel() {
            if (currentNowValue == true) {
                return sprintf(titleFormatter, " ", "immediately");
            }
            else {
                return sprintf(titleFormatter, " on ", squirtCommon.formatDate(time));
            }
        }

        return {
            getTitleHtml: getLabel,

            getTime: function() {   // -1 ==> immediately
                return currentNowValue ? -1 : time;
            },

            setNow: function(value) {
                currentNowValue = value != "0";
            },

            setDateString: function(value) {
                dateString = value;
            }
        }
    })();


    //
    // public api
    //
    return {
        drops: drops,
        photo: photo,
        envread: envread,
        runs: runs,
        interval: interval,
        start: start
    }
})();
