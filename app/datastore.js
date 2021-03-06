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
        const defaultValue = true;
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
            return squirtCommon.getRunLabel(value);
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
        const defaultUnit = "m";
        const titleFormatter = "with the interval of <span style='font-weight: bold; color: blue'><i>%s</i></span>";

        var currentValue = defaultValue;
        var currentUnit = defaultUnit;

        return {
            getTitleHtml: function() {
                return sprintf(titleFormatter, squirtCommon.getIntervalStringValue(currentValue, currentUnit));
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
        const timeFormat = "hh:mm A";
        const dateFormat = "MM/DD/YYYY";
        const timeDateFormat = timeFormat + " " + dateFormat

        const defaultNowValue = true;
        const titleFormatter = "starting <span style='font-weight: bold; color: blue'><i>%s</i></span>";

        var currentNowValue = defaultNowValue;
        var time = squirtCommon.getMilliSinceEpoch() + 60*60*1000;  // one hour later by default

        var timeString = "";
        var dateString = "";
        updateDateTimeStrings();

        function getTime() {   // -1 ==> immediately
            return currentNowValue ? -1 : time;
        }

        function updateDateTimeStrings() {
            timeString = moment(time).format(timeFormat);
            dateString = moment(time).format(dateFormat);
        }

        return {
            getTitleHtml: function() {
                return sprintf(titleFormatter, squirtCommon.formatStartTime(getTime()));
            },

            getTime: getTime,

            setNow: function(value) {
                currentNowValue = value != "0";
            },

            setTime: function(value) {
                time = value;
                updateDateTimeStrings();
            },

            getTimeString: function() {
                return timeString;
            },

            setTimeString: function(value) {
                timeString = value;
                time = moment(value + " " + dateString, timeDateFormat).valueOf();
            },

            getDateString: function() {
                return dateString;
            },

            setDateString: function(value) {
                dateString = value;
                time = moment(timeString + " " + value, timeDateFormat).valueOf();
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
