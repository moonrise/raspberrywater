/**
 * squirt details module
 */

var squirtDetails = (function () {
    const formatter = "<span style='font-weight: lighter;'>%s<span style='color: #7de0c2'>%s</span></span>";

    var currentTicket;          // fixed based on the page URL

    var historyItems;
    var currentIndex = -1;      // varies as user navigates
    var currentItem;            // for convenience and efficiency

    var currentDataItems
    var currentRunId = -1;
    var stopPlayMode = false

    var bringDownProgressBar;


    function onDetailsPageInit(event) {
        // refresh handler
        $("#details-prev-button").click(onDetailsPrev);
        $("#details-next-button").click(onDetailsNext);
        $("#details-play-button").click(onDetailsPlay);
        $("#details-refresh-button").click(onDetailsRefresh);
        $("#delete-confirm-button").click(onDeleteConfirm);

        // table row selection handler
        $("#data-table").on('click', 'tr', onDataTableRowClick);

        currentTicket = $(this).data("url").replace(/.*ticket=/, "");
        setCurrentIndex(-1);
        onDetailsRefresh();
    }

    function onDetailsRefresh() {
        squirtCommon.fetchActiveAndHistoricalList(30, onFetchAllListOK);
    }

    function setCurrentIndex(index) {
        currentIndex = index;
        if (currentIndex < 0) {
            currentItem = null;
        }
        else if (currentIndex < historyItems.length) {
            currentItem = historyItems[currentIndex];
        }

        updateButtonStates();
        updateCurrentIndexDetails();
    }

    function onDetailsNext() {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex-1);
        }
    }

    function onDetailsPrev() {
        if (currentIndex < historyItems.length -1) {
            setCurrentIndex(currentIndex+1);
        }
    }

    function displayBlockedDialog(message) {
        if (message != null && message.length > 0) {
            bringDownProgressBar = true;
            updateBlockedDialogMessage(message);
            $("#progress-popup").popup("open", { positionTo: '#details-page'});
        }
        else {
            $("#progress-popup").popup("close");
        }
    }

    function updateBlockedDialogMessage(message) {
        $("#progress-popup-message").html(message);
    }

    function onDetailsPlay() {
        stopPlayMode = false;
        currentRunId = 1;
        updatePhotoOnTimer();
    }

    function onDeleteConfirm() {
        if (currentItem.finished) {
            setTimeout(function() {     // since we can't nest popups
                displayBlockedDialog(sprintf("deleting task %d...", currentItem.ticket));
            }, 500);
            $.ajax(squirtCommon.buildJsonAPIRequest("deleteJob", { 'ticket': currentItem.ticket }, onDeleteOK));
        }
        else {
            $.ajax(squirtCommon.buildJsonAPIRequest("cancelJob", { 'ticket': currentItem.ticket }));
        }
    }

    function onDeleteOK(jsonResponse) {
        updateBlockedDialogMessage("Deleted. Updating the current view...");
        currentTicket = -1;
        onDetailsRefresh();
    }

    function updatePhotoOnTimer() {
        if (stopPlayMode) {
            return;
        }

        updatePhotoSection();

        if (currentRunId < currentItem.runsFinished) {
            currentRunId++;
            setTimeout(updatePhotoOnTimer, 500);
        }
    }

    function onDataTableRowClick(event) {
        event.preventDefault();

        // it is assumed that the runid is the text from the first column
        currentRunId = parseInt(this.innerText);
        stopPlayMode = true;
        validateRunIdAndUpdatePhotoSection();
    }

    function validateRunIdAndUpdatePhotoSection() {
        if (currentItem == null || currentItem.runsFinished < 1 || (currentItem.runs > 1 && currentDataItems == null)) {
            currentRunId = 0;
        }
        else if (currentRunId < 1 || currentRunId > currentItem.runsFinished) {     // boundary check
            currentRunId = 1;
        }
        updatePhotoSection();
    }

    function updateButtonStates() {
        if (currentItem == null) {
            $("#details-prev-button").addClass('ui-disabled');
            $("#details-next-button").addClass('ui-disabled');
            $("#details-play-button").addClass('ui-disabled');
            $("#details-delete-button").addClass('ui-disabled');
            return;
        }

        // prev/next buttons
        var totalItems = historyItems.length;
        if (currentIndex == 0) {
            $("#details-next-button").addClass('ui-disabled');
        }
        else {
            $("#details-next-button").removeClass('ui-disabled');
        }

        if (currentIndex >= totalItems-1) {
            $("#details-prev-button").addClass('ui-disabled');
        }
        else {
            $("#details-prev-button").removeClass('ui-disabled');
        }

        // play button
        if (currentItem.runsFinished < 2) {
            $("#details-play-button").addClass('ui-disabled');
        }
        else {
            $("#details-play-button").removeClass('ui-disabled');
        }

        // delete/cancel button
        if (currentItem.ticket <= 25) {  // protect them for demo
            $("#details-delete-button").addClass('ui-disabled');
        }
        else {
            $("#details-delete-button").removeClass('ui-disabled');
        }
        if (currentItem.finished) {
            $("#details-delete-button .ui-btn-text").html("delete");
            $("#delete-prompt-message").text(
                sprintf("Are you sure you want to delete task %d (delete can take a few seconds for " +
                    "this page to reflect the deletion)?", currentItem.ticket));
        }
        else {
            $("#details-delete-button .ui-btn-text").html("cancel");
            $("#delete-prompt-message").text(sprintf("Are you sure you want to cancel currently running task %d?", currentItem.ticket));
        }
    }

    function onFetchAllListOK(jsonResponse) {
        // stash history items for later navigation
        historyItems = jsonResponse.list;

        if (currentTicket <= 0 && historyItems.length > 0) {
            setCurrentIndex(0); // most recent
        }
        // locate the current index of the initial ticket
        else if (currentIndex < 0) {
            $.each(historyItems, function(index, value) {
                if (value.ticket == currentTicket) {
                    setCurrentIndex(index); // most recent
                    return false;  // breaking out of the loop since we're within this function scope
                }
            });
        }

        if (bringDownProgressBar) {
            bringDownProgressBar = false;
            displayBlockedDialog(null);
        }
    }

    function updateCurrentIndexDetails() {
        if (currentItem != null) {
            updateDetailsSection(currentItem);
            updateDataTableSection(currentItem);
        }
    }

    function updateDetailsSection(item) {
        // update title area
        var detailsHeader = sprintf(formatter, "details", sprintf(" (%d: %d/%d fetched tasks)",
                                                currentItem.ticket, currentIndex+1, historyItems.length));
        $("#details-bar .ui-btn-text").html(detailsHeader); // $(#details-bar).html() destroys the style

        // update detail area
        $("#details-request-items").html(
            sprintf('<strong>%d</strong>. %s',
                    item.ticket, squirtCommon.formatRequestItemsImage(item, 16)));
        $("#details-request-run").html(squirtCommon.formatRequestRunHtml(item));
        $("#details-request-time").text(squirtCommon.formatDate(item.requestDate));
        $("#details-request-note").text(item.requestNote);
        $("#details-delivery-time").text(squirtCommon.formatDate(item.deliveryDate));
        $("#details-delivery-stat").html(squirtCommon.getDeliveryStatHtml(item, 16));
        $("#details-delivery-note").html(squirtCommon.getDeliveryNoteHtml(item, 16));
    }

    function updatePhotoSection() {
        const PHOTO_TITLE = "photo";
        const PHOTO_DEBUG_TITLE = "photo debug";

        var photoHeader = PHOTO_TITLE;
        var debugHeader = PHOTO_DEBUG_TITLE;

        if (currentRunId > 0) {
            photoHeader = sprintf(formatter, "photo", sprintf(" - %d/%d", currentRunId, currentItem.runsFinished));
            debugHeader = sprintf(formatter, "photo debug", sprintf(" - %d/%d", currentRunId, currentItem.runsFinished));
        }

        $("#photo-details-bar .ui-btn-text").html(photoHeader);
        $("#debug-details-bar .ui-btn-text").html(debugHeader);

        if (currentRunId < 1) {
            displayNoImageAvailable();
            return;
        }

        var imageBlobKey = null;
        var imageBlobURL = null;
        if (currentItem.runs == 1) {
            imageBlobKey = currentItem.imageBlobKey;
            imageBlobURL = currentItem.imageBlobURL;
        }
        else {
            var index = currentRunId - 1;
            imageBlobKey = currentDataItems[index].imageBlobKey;
            imageBlobURL = currentDataItems[index].imageBlobURL;
        }

        // debug-only, so first show the url link text
        $("#details-blob-key").text(imageBlobKey);
        $("#details-blob-url").text(imageBlobURL);

        if (imageBlobURL == null || String(imageBlobURL).match(/None$/)) {
            displayNoImageAvailable();
            return;
        }

        // update image
        $("#details-image").attr('src', imageBlobURL);
        $("#details-image").attr('alt', imageBlobURL);
    }

    function updateDataTableSection(historyItem) {
        var tableHeader = sprintf(formatter, "data", sprintf(" (%d runs)", historyItem.runsFinished));
        $("#measure-details-bar .ui-btn-text").html(tableHeader);

        if (historyItem.runs == 1) {
            historyItem.runid = 1;        // simply add runid since it is missing!
            onTableDataReady([historyItem]);
        }
        else {
            // fetch the measurement data
            $.ajax(squirtCommon.buildJsonAPIRequest("fetchMeasures", {
                'ticket': historyItem.ticket
            }, function(jsonResponse) {
                onTableDataReady(jsonResponse.measures);
            }, function(xhr, status) {
                //alert("error: " + status + ", " + xhr);
            }));
        }
    }

    function onTableDataReady(dataItems) {
        currentDataItems = dataItems
        $("#table-body").html(buildTableRows(dataItems));
        $("#data-table").table('refresh');
        validateRunIdAndUpdatePhotoSection();
    }

    function buildTableRows(dataItems) {
        var htmlItems = [];

        $.each(dataItems, function(index, item) {
            var e = ['<tr>'];
            e.push(sprintf('<th>%d</th>', item.runid));

            if (item.temperature < 0) {
                e.push('<td>-na-</td>');
            }
            else {
                e.push(sprintf('<td>%dF (%d)</td>', squirtCommon.toFahrenheit(item.temperature), item.temperature));
            }

            if (item.moisture < 0) {
                e.push('<td>-na-</td>');
            }
            else {
                e.push(sprintf('<td>%d% (%d)</td>', squirtCommon.toMoisturePercent(item.moisture), item.moisture));
            }

            e.push(sprintf('<td>%s&nbsp;</td>',
                            item.imageBlobURL == "None" ? "" : squirtCommon.getPhotoImage(12)));
            e.push('</tr>');

            htmlItems.push(e.join(''));
        });

        return htmlItems.join('');
    }

    function displayNoImageAvailable() {
        $("#details-image").attr('src', "images2/not-available-320.png");
        $("#details-image").attr('alt', "No photo is available");
        $("#details-blob-key").text("none");
        $("#details-blob-url").text("none");
    }

    //
    // public API
    //
    return {
        onDetailsPageInit:onDetailsPageInit
    }
})();
