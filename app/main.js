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

    var isRequestPending = false;
    var remainingPollCount = 30;

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

        $("#drops-input").on('change', function(event) {
            ds.drops.setValue(event.target.value);
            $("#drops-header .ui-btn-text").html(ds.drops.getTitleHtml());
        });


        //
        // photo
        //
        $("#photo-header .ui-btn-text").html(ds.photo.getTitleHtml());

        $("#isphoto").val(ds.photo.getStringValue());
        $("#isphoto").slider("refresh");

        $("#isphoto").on('change', function(event) {
            ds.photo.setValue($(this).val());
            $("#photo-header .ui-btn-text").html(ds.photo.getTitleHtml());
        });


        //
        // env read
        //
        $("#envread-header .ui-btn-text").html(ds.envread.getTitleHtml());

        $("#isenvread").val(ds.envread.getStringValue());
        $("#isenvread").slider("refresh");

        $("#isenvread").on('change', function(event) {
            ds.envread.setValue($(this).val());
            $("#envread-header .ui-btn-text").html(ds.envread.getTitleHtml());
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


        //
        // start time
        //
        $("#start-header .ui-btn-text").html(ds.start.getTitleHtml());

        $("#start-select input[type='radio']").on('change', function(event) {
            ds.start.setNow(event.target.value);
            $("#start-header .ui-btn-text").html(ds.start.getTitleHtml());
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
        var maxPollCount = 1000;
        if (remainingPollCount < maxPollCount) {
            remainingPollCount = Math.min(remainingPollCount + 50, maxPollCount);
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

        $("#request-items").html(squirtCommon.formatRequestItemsHtml(jsonResponse, 14));
        if (jsonResponse.requestDate > 0) {
            isRequestPending = true;
            $("#request-run").html(squirtCommon.formatRequestRunHtml(jsonResponse));
            $("#request-time").text(squirtCommon.formatDate(jsonResponse.requestDate));
            $("#request-note").text(jsonResponse.requestNote);
        }
        else {
            isRequestPending = false;
            $("#request-run").text("");
            $("#request-time").text("");
            $("#request-note").text("");
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
            e.push(sprintf('<p style="font-size: 12px">request <strong>%d</strong>:  %s</p>',
                            item.ticket, squirtCommon.formatRequestItemsImage(item, 13)));
            e.push(sprintf('<p>request run: %s</p>', squirtCommon.formatRequestRunHtml(item)));
            e.push(sprintf('<p>%s <image src="images2/arrow-right.png" height=10/> %s</p>',
                            squirtCommon.formatDateShort(item.requestDate), squirtCommon.formatDateShort(item.deliveryDate)));
            e.push(sprintf('<p>delivery note: %s</p>', squirtCommon.getDeliveryStatusHtml(item, 12)));
            e.push('</a></li>');

            htmlItems.push(e.join(''));
        });

        return htmlItems.join('');
    }

    function updatePendingRequestStatusHeader() {
        var header = isRequestPending ? "pending request" : "no pending request";

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
            drops: ds.drops.getValue(),
            photo: ds.photo.getStringValue(),
            envread: ds.envread.getStringValue(),
            runs: ds.runs.getValue(),
            interval: ds.interval.getValue(),
            intervalUnit: ds.interval.getUnit(),
            start: ds.start.getTime(),
            requestNote: $("#note-input").val(),
            requestDate: squirtCommon.getMilliSinceEpoch().toString()
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
        $.ajax(squirtCommon.buildJsonAPIRequest("confirmSquirtDelivery",
            {
                ticket: parseInt($("#request-items").text()),   // get the first numeric digits only
                deliveryDate: squirtCommon.getMilliSinceEpoch().toString(),
                deliveryNote: isRequestPending ? "empty simulated delivery" : "simulated delivery"
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
