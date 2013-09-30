/**
 * Created with IntelliJ IDEA.
 * User: bjeong
 * Date: 9/15/13
 * Time: 10:55 AM
 *
 * squirt common module
 */

var squirtCommon = (function () {
    const DateFormat = "hh:mm:ss a, MM/DD/YYYY";
    const DateFormatShort = "hh:mm:ss a, MM/DD";
    const DateFormatShorter = "hh:mm a, MM/DD";


    function buildJsonAPIRequest(command, params, onOK, onNotOK, onDone) {
        var payload = {command: command};
        $.extend(payload, params);

        return {
            url: "/app/jsonApi",
            type: "POST",
            dataType: "json",
            data: JSON.stringify(payload),
            success: onOK,
            error: onNotOK,
            complete: onDone
        };
    }

    function fetchActiveTaskList(onOK, onNotOK, onDone) {
        $.ajax(buildJsonAPIRequest("fetchActiveTaskList", {}, onOK, onNotOK, onDone));
    }

    function fetchHistoryList(topN, onOK, onNotOK, onDone) {
        $.ajax(buildJsonAPIRequest("fetchHistoryList", { 'topN':topN }, onOK, onNotOK, onDone));
    }

    function fetchActiveAndHistoricalList(topN, onOK, onNotOK, onDone) {
        $.ajax(buildJsonAPIRequest("fetchActiveAndHistoricalList", { 'topN':topN }, onOK, onNotOK, onDone));
    }

    function getMilliSinceEpoch() {
        return moment().valueOf();
    }

    function formatDate(millisSinceEpoch) {
        return formatDateTime(millisSinceEpoch, DateFormat);
    }

    function formatDateShort(millisSinceEpoch) {
        return formatDateTime(millisSinceEpoch, DateFormatShort);
    }

    function formatDateShorter(millisSinceEpoch) {
        return formatDateTime(millisSinceEpoch, DateFormatShorter);
    }

    function formatDateTime(millisSinceEpoch, formatString) {
        if (millisSinceEpoch && millisSinceEpoch > 0) {
            return moment(millisSinceEpoch).format(formatString);
        }
        return "";
    }

    function getDefaultIconSize(size, defaultSize) {
        return size === undefined ? defaultSize : size;
    }

    function getWaterDropImages(howManyDrops, size) {
        size = getDefaultIconSize(size, 16);

        // nil icon
        if (howManyDrops <= 0) {
            return "";
        }

        // water drop icons in series
        var images = [];
        for (var i=0; i<howManyDrops; i++) {
            images.push(sprintf("<img src='images2/water.png' height='%d'/>", size));
        }
        return images.join('');
    }

    function getOkImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/ok.png' height='%d'/>", size);
    }

    function getOkBlackImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/ok-black.png' height='%d'/>", size);
    }

    function getQuestionImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/question.png' height='%d'/>", size);
    }

    function getNilImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/none.png' height='%d'/>", size);
    }

    function getBusyImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/big-roller.gif' height='%d'/>", size);
    }

    function getCameraImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/camera.png' height='%d'/>", size);
    }

    function getPhotoImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/photo.png' height='%d'/>", size);
    }

    function getGaugeImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/gauge.png' height='%d'/>", size);
    }

    function getRunCompletionPercent(json) {
        return Math.floor(100. * json.runsFinished / json.runs + 0.5);
    }

    function getRunStatusImage(json, iconSize) {
        var image = getQuestionImage(iconSize);
        if (getRunCompletionPercent(json) == 100) {
            image = getOkImage(iconSize);
        }
        else if (json.finished) {
            image = getOkBlackImage(iconSize);
        }
        else if (json.finished == false) {
            image = getBusyImage(iconSize);
        }
        return image;
    }

    function getDeliveryStatHtml(json, iconSize) {
        return sprintf("%d/%d runs finished (%d%) &nbsp; %s",
                        json.runsFinished, json.runs, getRunCompletionPercent(json), getRunStatusImage(json, iconSize));
    }

    function getDeliveryNoteHtml(json, iconSize) {
        return sprintf("%s", json.deliveryNote);
    }

    function getDeliveryStatusHtml(json, iconSize) {
        var runStat = sprintf("runs %d/%d (%d%)", json.runsFinished, json.runs, getRunCompletionPercent(json));
        return sprintf("%s - %s&nbsp;&nbsp;%s", runStat, json.deliveryNote, getRunStatusImage(json, iconSize));
    }

    function formatRequestItemsHtml(json, size) {
        return sprintf("%d.&nbsp;&nbsp;", json.ticket) + formatRequestItemsImage(json, size);
    }

    function formatRequestItemsImage(json, size) {
        var items = [];

        if (json.drops > 0) {
            items.push(squirtCommon.getWaterDropImages(json.drops, size));
        }
        if (json.photo == "1") {
            items.push(squirtCommon.getCameraImage(size));
        }
        if (json.envread == "1") {
            items.push(squirtCommon.getGaugeImage(size));
        }

        return items.length == 0 ? squirtCommon.getNilImage(size) : items.join('&nbsp;&nbsp;');
    }

    function formatRequestRunHtml(json) {
        if (json.runs <= 0) {
            return "--na--";
        }

        var runsText = "";
        if (json.runs == 1) {
            runsText = getRunLabel(json.runs);
        }
        else {
            runsText = sprintf("%dx%d%s", json.runs, json.interval, json.intervalUnit);
        }

        return runsText + " " + formatStartTime(json.start, true);
    }

    function getRunLabel(value) {
        if (value == 1) {
            return "once";
        }
        return sprintf("%d times", value);
    }

    function getIntervalStringValue(value, unit) {
        return sprintf("%d %s", value, getIntervalUnitLabel(value, unit));
    }

    function getIntervalUnitLabel(value, unit) {
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

    function formatStartTime(time, isCompact) {
        isCompact = isCompact === undefined ? false : isCompact;

        if (time < 0) {
            return "immediately";
        }

        if (isCompact) {
            return " @ " + formatDateShorter(time);
        }

        return " on " + formatDate(time);
    }

    function toFahrenheit(count) {
        var milliVolts = count * (3300.0 / 1023.0);
        var celsius = ((milliVolts - 100.0) / 10.0) - 40.0;
        return (celsius * 9.0/5.0) + 32.0;
    }

    function toMoisturePercent(count) {
        return Math.min(100, count/800 * 100);  // 800 is saturation point (submerged in water)
    }

    //
    // public API
    //
    return {
        getDateFormat: function() { return DateFormat; },
        getDateFormatShort: function() { return DateFormatShort; },
        formatDate: formatDate,
        formatDateShort: formatDateShort,
        getMilliSinceEpoch: getMilliSinceEpoch,
        toFahrenheit: toFahrenheit,
        toMoisturePercent: toMoisturePercent,

        buildJsonAPIRequest: buildJsonAPIRequest,
        fetchActiveTaskList: fetchActiveTaskList,
        fetchHistoryList: fetchHistoryList,
        fetchActiveAndHistoricalList: fetchActiveAndHistoricalList,

        formatRequestItemsHtml: formatRequestItemsHtml,
        formatRequestItemsImage: formatRequestItemsImage,
        formatRequestRunHtml: formatRequestRunHtml,
        formatStartTime: formatStartTime,
        getRunLabel: getRunLabel,
        getIntervalStringValue: getIntervalStringValue,
        getDeliveryStatHtml: getDeliveryStatHtml,
        getDeliveryNoteHtml: getDeliveryNoteHtml,
        getDeliveryStatusHtml: getDeliveryStatusHtml,

        getOKImage: getOkImage,
        getQuestionImage: getQuestionImage,
        getWaterDropImages: getWaterDropImages,
        getNilImage: getNilImage,
        getCameraImage: getCameraImage,
        getPhotoImage: getPhotoImage,
        getGaugeImage: getGaugeImage
    }
})();
