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
        // updatePendingRequestRepeatedly();
        updatePendingRequest();

        // squirt request handler
        $("#request-squirt-button").click(onSquirtRequest);

        // simulate squirt delivery handler
        $("#simulate-squirt-delivery-button").click(onSimulateSquirtDelivery);
    }

    function updatePendingRequestRepeatedly() {
        updatePendingRequest();
        setTimeout(updatePendingRequestRepeatedly, UPDATE_INTERVAL);
    }

    function updatePendingRequest() {
        $.ajax(buildJsonAPIRequest("fetchPendingRequest", {},
            onFetchPendingRequestStatusOK,
            onFetchPendingRequestStatusNotOK,
            onFetchPendingRequestStatusDone));
    }

    function onFetchPendingRequestStatusOK(jsonResponse) {
        updateCount++;

        if (jsonResponse.drops > 0) {
            $("#pending-request-section-header").html("pending request");
            $("#ticket-value").text(jsonResponse.ticket.toString());
            $("#drop-value").text(jsonResponse.drops.toString());
            $("#datetime-value").text(moment(jsonResponse.date).format("hh:mm:ss a, MM/DD/YYYY"));
            $("#comment-value").text(jsonResponse.comment);
        }
        else {
            $("#pending-request-section-header").html("no pending request");
            $("#ticket-value").text("");
            $("#drop-value").text("");
            $("#datetime-value").text("");
            $("#comment-value").text("");
        }
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
