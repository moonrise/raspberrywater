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

    function formatDate(millisSinceEpoch) {
        return moment(millisSinceEpoch).format(DateFormat);
    }

    function formatDateShort(millisSinceEpoch) {
        if (millisSinceEpoch && millisSinceEpoch > 0) {
            return moment(millisSinceEpoch).format(DateFormatShort);
        }
        return "";
    }

    function getWaterDropImages(howManyDrops, size) {
        var images = [];

        for (var i=0; i<howManyDrops; i++) {
            images.push(sprintf("<img src='images2/water.png' height='%d'/>", size));
        }

        return images.join('');
    }


    //
    // public API
    //
    return {
        getDateFormat: function() { return DateFormat; },
        getDateFormatShort: function() { return DateFormatShort; },
        formatDate: formatDate,
        formatDateShort: formatDateShort,

        buildJsonAPIRequest: buildJsonAPIRequest,
        fetchHistoryList: fetchHistoryList,

        getWaterDropImages: getWaterDropImages
    }
})();
