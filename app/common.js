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

    function fetchHistoryList(topN, onOK, onNotOK, onDone) {
        $.ajax(buildJsonAPIRequest("fetchHistoryList", {}, onOK, onNotOK, onDone));
    }

    function getMilliSinceEpoch() {
        return moment().valueOf();
    }

    function formatDate(millisSinceEpoch) {
        if (millisSinceEpoch && millisSinceEpoch > 0) {
            return moment(millisSinceEpoch).format(DateFormat);
        }
        return "";
    }

    function formatDateShort(millisSinceEpoch) {
        if (millisSinceEpoch && millisSinceEpoch > 0) {
            return moment(millisSinceEpoch).format(DateFormatShort);
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

    function getQuestionImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/question.png' height='%d'/>", size);
    }

    function getNilImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/none.png' height='%d'/>", size);
    }

    function getCameraImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/camera.png' height='%d'/>", size);
    }

    function getGaugeImage(size) {
        size = getDefaultIconSize(size, 16);
        return sprintf("<img src='images2/gauge.png' height='%d'/>", size);
    }

    function iconifyDeliveryNote(deliverNote, size) {
        if (deliverNote == null || deliverNote.length == 0) {
            return getQuestionImage(size);
        }

        if (deliverNote.toLowerCase() == "ok") {
            return getOkImage(size);
        }

        return sprintf("%s (%s)", getQuestionImage(size), deliverNote);
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

        return items.length == 0 ? squirtCommon.getNilImage(size) : items.join('&nbsp;');
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

        buildJsonAPIRequest: buildJsonAPIRequest,
        fetchHistoryList: fetchHistoryList,

        formatRequestItemsHtml: formatRequestItemsHtml,
        formatRequestItemsImage: formatRequestItemsImage,
        iconifyDeliveryNote: iconifyDeliveryNote,

        getOKImage: getOkImage,
        getQuestionImage: getQuestionImage,
        getWaterDropImages: getWaterDropImages,
        getNilImage: getNilImage,
        getCameraImage: getCameraImage,
        getGaugeImage: getGaugeImage
    }
})();
