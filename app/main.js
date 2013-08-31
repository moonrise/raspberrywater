/**
 * Created with IntelliJ IDEA.
 * User: bjeong
 * Date: 8/30/13
 * Time: 5:22 PM
 *
 * squirt main in module pattern
 */

var squirtMain = (function () {
    var UPDATE_INTERVAL = 2000;
    var updateCount = 0;

    function appBootstrap() {
        // polled pending request update
        updatePendingRequestRepeatedly();

        // squirt request handler
        $("#request-squirt-button").click(onSquirtRequest);
    }

    function updatePendingRequestRepeatedly() {
        updatePendingRequest();
        setTimeout(updatePendingRequestRepeatedly, UPDATE_INTERVAL);
    }

    function updatePendingRequest() {
        updateCount++;
        $("#ticket-value").text("" + updateCount);

        var dropValue = $("#drop-input").val();
        $("#drop-value").text("" + dropValue);

        var miliSinceEpoch = moment();
        $("#datetime-value").text(moment(miliSinceEpoch).format("hh:mm:ss a, MM/DD/YYYY"));

        var commentValue = $("#comment-input").val();
        $("#comment-value").text("" + commentValue);
    }

    function onSquirtRequest() {
        updatePendingRequest();
    }

    // public API
    return {
        appBootstrap: appBootstrap
    }
})();
