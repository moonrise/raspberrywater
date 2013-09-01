/**
 * Created with IntelliJ IDEA.
 * User: bjeong
 * Date: 8/30/13
 * Time: 5:22 PM
 *
 * squirt main in module pattern
 */

var squirtMain = (function () {
    var UPDATE_INTERVAL = 1000;
    var pendingRequestDrops = 0;
    var remainingPollCount = 3;

    function appBootstrap() {
        updatePendingRequest();

        // polled pending request update
        updatePendingRequestRepeatedly();

        // squirt request handler
        $("#request-squirt-button").click(onSquirtRequest);

        // simulate squirt delivery handler
        $("#simulate-squirt-delivery-button").click(onSimulateSquirtDelivery);

        // refresh handler
        $("#pending-request-refresh-button").click(onPendingRequestStatusRefreshButton);
    }

    function updatePendingRequestRepeatedly() {
        if (remainingPollCount > 0) {
            remainingPollCount--;
            updatePendingRequest();
        }
        setTimeout(updatePendingRequestRepeatedly, UPDATE_INTERVAL);
    }

    function activateTransientPolling() {
        var maxPollCount = 60;
        if (remainingPollCount < maxPollCount) {
            remainingPollCount = Math.min(remainingPollCount + 10, maxPollCount);
        }
    }

    function updatePendingRequest() {
        $.ajax(buildJsonAPIRequest("fetchPendingRequest", {},
            onFetchPendingRequestStatusOK,
            onFetchPendingRequestStatusNotOK,
            onFetchPendingRequestStatusDone));
    }

    function onFetchPendingRequestStatusOK(jsonResponse) {
        pendingRequestDrops = jsonResponse.drops;
        updatePendingRequestStatusHeader();

        if (jsonResponse.drops > 0) {
            $("#ticket-value").text(jsonResponse.ticket.toString());
            $("#drop-value").text(jsonResponse.drops.toString());
            $("#datetime-value").text(moment(jsonResponse.date).format("hh:mm:ss a, MM/DD/YYYY"));
            $("#comment-value").text(jsonResponse.comment);
        }
        else {
            $("#ticket-value").text("");
            $("#drop-value").text("");
            $("#datetime-value").text("");
            $("#comment-value").text("");
        }
    }

    function updatePendingRequestStatusHeader() {
        var header = pendingRequestDrops > 0 ? "pending request" : "no pending request";

        if (remainingPollCount > 0) {
            header += (" (remaining poll count: " + remainingPollCount + ")");
        }

        $("#pending-request-section-header").html(header);
    }

    function onFetchPendingRequestStatusNotOK(xhr, status) {
    }

    function onFetchPendingRequestStatusDone(xhr, status) {
    }

    function onSquirtRequest() {
        $.ajax(buildJsonAPIRequest("submitSquirtRequest",
            collectSquirtRequestParameters(),
            onSquirtRequestOK, onSquirtRequestNotOK, onSquirtRequestDone));
    }

    function collectSquirtRequestParameters() {
        return {
            drops: $("#drop-input").val(),
            comment: $("#comment-input").val(),
            date: moment().valueOf().toString()
        }
    }

    function onSquirtRequestOK(jsonResponse) {
    }

    function onSquirtRequestNotOK(xhr, status) {
    }

    function onSquirtRequestDone(xhr, status) {
        updatePendingRequest();
        activateTransientPolling();
    }

    function onPendingRequestStatusRefreshButton() {
        updatePendingRequest();
        activateTransientPolling();
    }

    function onSimulateSquirtDelivery() {
        $.ajax(buildJsonAPIRequest("confirmSquirtDelivery",
            {
                ticket: $("#ticket-value").text(),
                date: moment().valueOf().toString(),
                comment: "delivered"
            },
            null, null, onSimulateSquirtDeliveryDone));
    }

    function onSimulateSquirtDeliveryDone(xhr, status) {
        updatePendingRequest();
        activateTransientPolling();
    }

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

    //
    // public API
    //
    return {
        appBootstrap: appBootstrap
    }
})();
