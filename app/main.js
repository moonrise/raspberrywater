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

    var myPendingStateCid = -1;
    var myHistoryListCid = -1;


    function appBootstrap() {
        updateRemoteState();

        // polled pending request update
        updateRemoteStateRepeatedly();

        // squirt request handler
        $("#request-squirt-button").click(onSquirtRequest);

        // simulate squirt delivery handler
        $("#simulate-squirt-delivery-button").click(onSimulateSquirtDelivery);

        // refresh handler
        $("#pending-request-refresh-button").click(onPendingRequestStatusRefreshButton);
    }

    function updateRemoteStateRepeatedly() {
        if (remainingPollCount > 0) {
            remainingPollCount--;
            updateRemoteState();
        }
        setTimeout(updateRemoteStateRepeatedly, UPDATE_INTERVAL);
    }

    function activateTransientPolling() {
        var maxPollCount = 60;
        if (remainingPollCount < maxPollCount) {
            remainingPollCount = Math.min(remainingPollCount + 10, maxPollCount);
        }
    }

    function updateRemoteState() {
        $.ajax(buildJsonAPIRequest("queryChangeState", {},
            onQueryChangeState,
            onQueryChangeStateNotOK,
            onQueryChangeStateDone));
    }

    function onQueryChangeState(jsonResponse) {
        var pendingStateCid = jsonResponse.pendingStateCid;
        if (pendingStateCid != myPendingStateCid) {
            myPendingStateCid = pendingStateCid;
            $.ajax(buildJsonAPIRequest("fetchPendingRequest", {}, onFetchPendingRequestStatusOK));
        }

        var historyListCid = jsonResponse.historyListCid;
        if (historyListCid != myHistoryListCid) {
            myHistoryListCid = historyListCid;
            $.ajax(buildJsonAPIRequest("fetchHistoryList", {}, onFetchHistoryListOK));
        }
    }

    function onQueryChangeStateNotOK(xhr, status) {
        // general connection problem?
    }

    function onQueryChangeStateDone(xhr, status) {
        updatePendingRequestStatusHeader();
    }

    function onFetchPendingRequestStatusOK(jsonResponse) {
        pendingRequestDrops = jsonResponse.drops;

        $("#ticket-value").text(jsonResponse.ticket.toString());
        if (jsonResponse.drops > 0) {
            $("#drop-value").text(jsonResponse.drops.toString());
            $("#datetime-value").text(moment(jsonResponse.requestDate).format("hh:mm:ss a, MM/DD/YYYY"));
            $("#comment-value").text(jsonResponse.comment);
        }
        else {
            $("#drop-value").text("");
            $("#datetime-value").text("");
            $("#comment-value").text("");
        }
    }

    function onFetchHistoryListOK(jsonResponse) {
        // title area
        var formatter = "history <span style='font-weight: lighter; color: #7de0c2'><i> - most recent %d</i></span>";
        var htmlTitle = sprintf(formatter,  jsonResponse.length);
        $("#history-bar .ui-btn-text").html(htmlTitle); // $(#history-bar).html() destroys the style

        // actual list
        var liItems = buildHistoryList(jsonResponse.histories);
        $("#history-list").html(liItems);
        $("#history-list").listview('refresh');
    }

    function buildHistoryList(items) {
        const images = 20;
        var htmlItems = [];

        var randomImage = Math.floor(Math.random() * images);
        $.each(items, function(index, item) {
            var e = ['<li>'];
            e.push(sprintf('<img src="images2/green-leaf-%d.jpg" hspace="3" vspace="3"/>', ++randomImage % images));
            e.push('</li>');

            htmlItems.push(e.join(''));
        });

        return htmlItems.join('');
    }

    function updatePendingRequestStatusHeader() {
        var header = pendingRequestDrops > 0 ? "pending request" : "no pending request";

        if (remainingPollCount > 0) {
            var formatter = "%s <span style='font-weight: lighter; color: #7de0c2'><i> - poll count %d</i></span>";
            var htmlTitle = sprintf(formatter,  header, remainingPollCount);
            header = htmlTitle;
        }

        $("#pending-request-section-header").html(header);
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
            requestDate: moment().valueOf().toString()
        }
    }

    function onSquirtRequestOK(jsonResponse) {
    }

    function onSquirtRequestNotOK(xhr, status) {
    }

    function onSquirtRequestDone(xhr, status) {
        updateRemoteState();
        activateTransientPolling();
    }

    function onPendingRequestStatusRefreshButton() {
        updateRemoteState();
        activateTransientPolling();
    }

    function onSimulateSquirtDelivery() {
        if ($("#drop-value").text() <= 0) {
            return
        }

        $.ajax(buildJsonAPIRequest("confirmSquirtDelivery",
            {
                ticket: $("#ticket-value").text(),
                deliveryDate: moment().valueOf().toString(),
                note: "delivered"
            },
            null, null, onSimulateSquirtDeliveryDone));
    }

    function onSimulateSquirtDeliveryDone(xhr, status) {
        updateRemoteState();
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
