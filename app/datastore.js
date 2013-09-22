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

        var currentValue = 1;

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


    var runs = (function() {
        const defaultValue = 1;
        const titleFormatter = "run <span style='font-weight: bold; color: blue'><i>%s</i></span>";

        var currentValue = 1;

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

        var currentValue = 1;
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


    //
    // public api
    //
    return {
        drops: drops,
        runs: runs,
        interval: interval
    }
})();
