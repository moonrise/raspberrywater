/**
 * Created with IntelliJ IDEA.
 * User: bjeong
 * Date: 8/30/13
 * Time: 5:22 PM
 *
 * squirt main in module pattern
 */

var squirtMain = (function () {
    const UPDATE_INTERVAL = 1000;
    const RefreshButtonText = "refresh";

    var remainingPollCount = 30;
    var myActiveStateCid = -1;
    var myHistoryListCid = -1;


    function appBootstrap() {
        // initial update followed by polled pending request update
        updateRemoteState();
        updateRemoteStateRepeatedly();

        // squirt request handler
        $("#request-squirt-button").click(onSquirtRequest);

        // simulate squirt delivery handler
        $("#update-photo-button").click(onUpdatePhotoButton);

        // refresh handler
        $("#refresh-button").click(onRefreshButton);
        $("#refresh-button .ui-btn-text").html(RefreshButtonText);

        // navigation event handlers
//        $("#doc-button").click(navigateToDocView);
        $("#details-button").click(navigateToDetailsView2);
        $("#active-task-list").on('click', 'li a', navigateToDetailsView);
        $("#history-list").on('click', 'li a', navigateToDetailsView);

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
        $("#start-time").trigger('datebox', {'method':'set', 'value':ds.start.getTimeString()});
        $("#start-date").trigger('datebox', {'method':'set', 'value':ds.start.getDateString()});

        $("#start-select input[type='radio']").on('change', function(event) {
            ds.start.setNow(event.target.value);
            $("#start-header .ui-btn-text").html(ds.start.getTitleHtml());
        });

        $("#start-time").bind('datebox', function(event, passed) {
            if (passed.method == 'set') {
                event.stopImmediatePropagation();
                ds.start.setTimeString(passed.value);
                $("#start-header .ui-btn-text").html(ds.start.getTitleHtml());
            }
        });

        $("#start-date").bind('datebox', function(event, passed) {
            if (passed.method == 'set') {
                event.stopImmediatePropagation();
                ds.start.setDateString(passed.value);
                $("#start-header .ui-btn-text").html(ds.start.getTitleHtml());
            }
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
            onQueryChangeState, null, onQueryChangeStateDone));
    }

    function onQueryChangeState(jsonResponse) {
        var formatter = "<span style='font-weight: lighter; color: darkblue'><i>%s, %dF, %d%</i></span>";
        var text = sprintf(formatter,
                            squirtCommon.formatDateShort(jsonResponse.lastRpiTime),
                            squirtCommon.toFahrenheit(jsonResponse.lastRpiTemperature),
                            squirtCommon.toMoisturePercent(jsonResponse.lastRpiMoisture));
        $("#rpi-last-beat").html(text);

        var activeStateCid = jsonResponse.activeStateCid;
        if (activeStateCid != myActiveStateCid) {
            myActiveStateCid = activeStateCid;
            squirtCommon.fetchActiveTaskList(onFetchActiveTaskListOK);
        }

        var historyListCid = jsonResponse.historyListCid;
        if (historyListCid != myHistoryListCid) {
            myHistoryListCid = historyListCid;
            squirtCommon.fetchHistoryList(10, onFetchHistoryListOK);
        }
    }

    function onQueryChangeStateDone(xhr, status) {
        if (remainingPollCount > 0) {
            var formatter = "%s <span style='font-weight: lighter; color: darkblue'><i>(%d)</i></span>";
            var text = sprintf(formatter, RefreshButtonText, remainingPollCount);
            $("#refresh-button .ui-btn-text").html(text);
        }
        else {
            $("#refresh-button .ui-btn-text").html(RefreshButtonText);
        }
    }

    function onFetchActiveTaskListOK(jsonResponse) {
        // title area
        var formatter = "active tasks <span style='font-weight: lighter; color: #7de0c2'><i> - %d</i></span>";
        var htmlTitle = sprintf(formatter,  jsonResponse.length);
        $("#active-task-bar .ui-btn-text").html(htmlTitle); // $(#history-bar).html() destroys the style

        // actual list
        var liItems = buildDeliveryList(jsonResponse.list);
        $("#active-task-list").html(liItems);
        $("#active-task-list").listview('refresh');
    }

    function onFetchHistoryListOK(jsonResponse) {
        // title area
        var formatter = "history <span style='font-weight: lighter; color: #7de0c2'><i> - most recent %d</i></span>";
        var htmlTitle = sprintf(formatter,  jsonResponse.length);
        $("#history-bar .ui-btn-text").html(htmlTitle); // $(#history-bar).html() destroys the style

        // actual list
        var liItems = buildDeliveryList(jsonResponse.list);
        $("#history-list").html(liItems);
        $("#history-list").listview('refresh');
    }

    function buildDeliveryList(items) {
        const images = 20;
        var htmlItems = [];

        var randomImage = Math.floor(Math.random() * images);
        $.each(items, function(index, item) {
            var imageFile = item.deliveryDate ? sprintf("green-leaf-%d.jpg", ++randomImage % images) : "no-water.png";
            var e = ['<li>'];
            //e.push(sprintf('<p class="ui-li-aside">Note</p>')); // not working well
            e.push(sprintf('<a href="#" id=%d>', item.ticket));
            e.push(sprintf('<img src="images2/%s" hspace="6" vspace="6"/>', imageFile));
            e.push(sprintf('<p style="font-size: 12px">request <strong>%d</strong>:  %s</p>',
                            item.ticket, squirtCommon.formatRequestItemsImage(item, 13)));
            e.push(sprintf('<p>request run: %s</p>', squirtCommon.formatRequestRunHtml(item)));
            e.push(sprintf('<p>%s <image src="images2/arrow-right.png" height=10/> %s</p>',
                            squirtCommon.formatDateShort(item.requestDate), squirtCommon.formatDateShort(item.deliveryDate)));
            e.push(sprintf('<p>delivery: %s</p>', squirtCommon.getDeliveryStatusHtml(item, 12)));
            e.push('</a></li>');

            htmlItems.push(e.join(''));
        });

        return htmlItems.join('');
    }

    function onSquirtRequest() {
        $("#request-squirt-button").addClass("ui-disabled");
        $.ajax(squirtCommon.buildJsonAPIRequest("submitSquirtRequest",
               collectSquirtRequestParameters(), null, null, onSquirtRequestDone));

        // disable the button so that users can't click repeatedly
        setTimeout(function() {
            $("#request-squirt-button").removeClass("ui-disabled");
        }, 5000)
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
            requestDate: squirtCommon.getMilliSinceEpoch()
        }
    }

    function onSquirtRequestDone(xhr, status) {
        updateRemoteState();
        activateTransientPolling();
    }

    function onRefreshButton() {
        updateRemoteState();
        activateTransientPolling();
    }

    function onUpdatePhotoButton() {
    }

    /*
    with multiple request supports, it is not easy to support simulation any longer...
    function onSimulateSquirtDelivery() {
        $.ajax(squirtCommon.buildJsonAPIRequest("confirmDelivery",
            {
                ticket: parseInt($("#request-items").text()),   // get the first numeric digits only
                runs: ds.runs.getValue(),
                runid: 1,
                temperature: 199,
                moisture: 299,
                finished: '1',
                deliveryDate: squirtCommon.getMilliSinceEpoch().toString(),
                deliveryNote: isRequestPending ? "simulated delivery" : "empty simulated delivery"
            },
            null, null, onSimulateSquirtDeliveryDone));
    }
    */

    function onSimulateSquirtDeliveryDone(xhr, status) {
        updateRemoteState();
        activateTransientPolling();
    }

    function navigateToDetailsView(event) {
        event.preventDefault();
        $.mobile.changePage('details.html', {
            transition:"slide",
            data: { ticket: this.id }
        });
    }

    function navigateToDetailsView2(event) {
        event.preventDefault();
        $.mobile.changePage('details.html', {
            transition:"slide",
            data: { ticket: -1 }
        });
    }

    //
    // public API
    //
    return {
        appBootstrap: appBootstrap
    }
})();
