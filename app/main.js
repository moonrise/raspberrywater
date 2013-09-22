/**
 * Created with IntelliJ IDEA.
 * User: bjeong
 * Date: 8/30/13
 * Time: 5:22 PM
 *
 * squirt main in module pattern
 */

var squirtMain = (function () {
    const DateFormat = "hh:mm:ss a, MM/DD";
    const UPDATE_INTERVAL = 1000;

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

        // list view click handler
        $("#history-list").on('click', 'li a', navigateToHistoryDetailView);

        initRequestParameters();
    }

    function initRequestParameters() {
        //
        // drops
        //
        $("#drops-header .ui-btn-text").html(ds.drops.getTitleHtml());

        $("#drop-input").on('change', function(event) {
            ds.drops.setValue(event.target.value);
            $("#drops-header .ui-btn-text").html(ds.drops.getTitleHtml());
        });


        //
        // runs
        //
        $("#runs-header .ui-btn-text").html(ds.runs.getTitleHtml());

        $("#runs").on('change', function(event) {
            ds.runs.setValue(event.target.value);
            $("#runs-header .ui-btn-text").html(ds.runs.getTitleHtml());
        });

        //
        // interval
        //
        $("#interval-header .ui-btn-text").html(ds.interval.getTitleHtml());

        // sync with the data and ui
        $("#interval-unit input[type='radio']").each(function(i, el) {
            if (el.value == ds.interval.getUnit()) {
                // hard to believe, but need to click twice ?!!!
                $(el).click(); $(el).click();
            }
        });

        // event handlers
        $("#interval").on('change', function(event) {
            ds.interval.setValue(event.target.value);
            $("#interval-header .ui-btn-text").html(ds.interval.getTitleHtml());
        });

        $("#interval-unit input[type='radio']").on('change', function(event) {
            ds.interval.setUnit(event.target.value);
            $("#interval-header .ui-btn-text").html(ds.interval.getTitleHtml());
        });
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
        $.ajax(squirtCommon.buildJsonAPIRequest("queryChangeState", {},
            onQueryChangeState,
            onQueryChangeStateNotOK,
            onQueryChangeStateDone));
    }

    function onQueryChangeState(jsonResponse) {
        var pendingStateCid = jsonResponse.pendingStateCid;
        if (pendingStateCid != myPendingStateCid) {
            myPendingStateCid = pendingStateCid;
            $.ajax(squirtCommon.buildJsonAPIRequest("fetchPendingRequest", {}, onFetchPendingRequestStatusOK));
        }

        var historyListCid = jsonResponse.historyListCid;
        if (historyListCid != myHistoryListCid) {
            myHistoryListCid = historyListCid;
            squirtCommon.fetchHistoryList(10, onFetchHistoryListOK);
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
            $("#drop-value").html(squirtCommon.getWaterDropImages(jsonResponse.drops, 14));
            $("#datetime-value").text(moment(jsonResponse.requestDate).format(DateFormat));
            $("#note-value").text(jsonResponse.requestNote);
        }
        else {
            $("#drop-value").html("");
            $("#datetime-value").text("");
            $("#note-value").text("");
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
            var imageFile = item.deliveryDate ? sprintf("green-leaf-%d.jpg", ++randomImage % images) : "no-water.png";
            var e = ['<li>'];
            //e.push(sprintf('<p class="ui-li-aside">Note</p>')); // not working well
            e.push(sprintf('<a href="#" data-transition="flip" id=%d>', item.ticket));
            e.push(sprintf('<img src="images2/%s" hspace="6" vspace="6"/>', imageFile));
            e.push(sprintf('<p style="font-size: 14px">ticket: <strong>%d</strong>, drops: %s</p>',
                            item.ticket, squirtCommon.getWaterDropImages(item.drops, 13)));
            e.push(sprintf('<p>%s <image src="images2/arrow-right.png" height=10/> %s</p>',
                            squirtCommon.formatDateShort(item.requestDate), squirtCommon.formatDateShort(item.deliveryDate)));
            e.push(sprintf('<p>request note: %s</p>', item.requestNote));
            e.push(sprintf('<p>delivery note: %s</p>', squirtCommon.iconifyDeliveryNote(item.deliveryNote, 10)));
            e.push('</a></li>');

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
        $.ajax(squirtCommon.buildJsonAPIRequest("submitSquirtRequest",
            collectSquirtRequestParameters(),
            onSquirtRequestOK, onSquirtRequestNotOK, onSquirtRequestDone));
    }

    function collectSquirtRequestParameters() {
        return {
            drops: $("#drop-input").val(),
            requestNote: $("#note-input").val(),
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
        var isNoDrops = $("#drop-value").html() == "";
        $.ajax(squirtCommon.buildJsonAPIRequest("confirmSquirtDelivery",
            {
                ticket: $("#ticket-value").text(),
                deliveryDate: moment().valueOf().toString(),
                deliveryNote: isNoDrops ? "empty simulated delivery" : "simulated delivery"
            },
            null, null, onSimulateSquirtDeliveryDone));
    }

    function onSimulateSquirtDeliveryDone(xhr, status) {
        updateRemoteState();
        activateTransientPolling();
    }

    function navigateToHistoryDetailView(event) {
        event.preventDefault();
        $.mobile.changePage('details.html', {
            transition:"slide",
            data: { ticket: this.id }
        });
    }


    //
    // public API
    //
    return {
        appBootstrap: appBootstrap
    }
})();
