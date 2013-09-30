/**
 * squirt details module
 */

var squirtDetails = (function () {
    const formatter = "<span style='font-weight: lighter;'>%s<span style='color: #7de0c2'>%s</span></span>";

    var currentTicket;          // fixed based on the page URL

    var historyItems;
    var currentIndex = -1;      // varies as user navigates

    var currentDataItems
    var currentRunid = -1;


    function onDetailsPageInit(event) {
        // refresh handler
        $("#details-prev-button").click(onDetailsPrev);
        $("#details-next-button").click(onDetailsNext);
        $("#details-play-button").click(onDetailsPlay);
        $("#details-cancel-button").click(onDetailsCancel);
        $("#details-refresh-button").click(onDetailsRefresh);

        // table row selection handler
        $("#data-table").on('click', 'tr', onDataTableRowClick);

        currentTicket = $(this).data("url").replace(/.*ticket=/, "");
        currentIndex = -1;
        updateButtonStates();
        onDetailsRefresh();
    }

    function onDetailsRefresh() {
        squirtCommon.fetchActiveAndHistoricalList(30, onFetchAllListOK);
    }

    function onDetailsNext() {
        if (currentIndex > 0) {
            currentIndex--;
            updateButtonStates();
            updateCurrentIndexDetails();
        }
    }

    function onDetailsPrev() {
        if (currentIndex < historyItems.length -1) {
            currentIndex++;
            updateButtonStates();
            updateCurrentIndexDetails()
        }
    }

    function onDetailsPlay() {
        if (currentItem == null || currentItem.runsFinished < 2) {
            return;
        }

        // start
        currentRunid = 1;
        updatePhotoOnTimer();
    }

    function onDetailsCancel() {
        if (currentItem == null || currentItem.finished) {
            return;
        }

        // request cancel - hope it is honored
        $.ajax(squirtCommon.buildJsonAPIRequest("cancelJob", {
            'ticket': currentItem.ticket }));
    }

    function updatePhotoOnTimer() {
        updatePhotoSection();

        if (currentRunid < currentItem.runsFinished) {
            currentRunid++;
            setTimeout(updatePhotoOnTimer, 500);
        }
    }



    function onDataTableRowClick(event) {
        event.preventDefault();

        // it is assumed that the runid is the text from the first column
        currentRunid = parseInt(this.innerText);
        updateRunId();
    }

    function updateRunId() {
        if (currentItem != null && (currentRunid < 1 || currentRunid > currentItem.runs)) {
            currentRunid = 1;
        }
        updatePhotoSection();
    }

    function updateButtonStates() {
        // todo: won't work - add/remove class may need to look if it's there or not first?!!
        return;

        var totalItems = historyItems.length;

        if (totalItems <= 0 || currentIndex == 0) {
            $("#details-next-button").addClass('ui-disabled');
        }
        else {
            $("#details-next-button").removeClass('ui-disabled');
        }

        if (totalItems <= 0 || currentIndex >= totalItems-1) {
            $("#details-prev-button").addClass('ui-disabled');
        }
        else {
            $("#details-prev-button").removeClass('ui-disabled');
        }

        $("#details-prev-button").button('refresh');
        $("#details-next-button").button('refresh');
    }

    function onFetchAllListOK(jsonResponse) {
        // stash history items for later navigation
        historyItems = jsonResponse.list;

        if (currentTicket <= 0 && historyItems.length > 0) {
            currentIndex = 0;   // most recent
            updateButtonStates();
        }
        // locate the current index of the initial ticket
        else if (currentIndex < 0) {
            $.each(historyItems, function(index, value) {
                if (value.ticket == currentTicket) {
                    currentIndex = index;
                    updateButtonStates();
                    return false;  // breaking out of the loop since we're within this function scope
                }
            });
        }

        if (currentIndex >= 0) {
            updateCurrentIndexDetails()
        }
    }

    function updateCurrentIndexDetails() {
        currentItem = historyItems[currentIndex];
        updateDetailsSection(currentItem);
        updateDataTableSection(currentItem);
    }

    function updateDetailsSection(item) {
        // update title area
        var detailsHeader = sprintf(formatter, "details", sprintf(" (%d tickets fetched)", historyItems.length));
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
        var photoHeader = sprintf(formatter, "photo", sprintf(" - %d/%d", currentRunid, currentItem.runsFinished));
        var debugHeader = sprintf(formatter, "photo debug", sprintf(" - %d/%d", currentRunid, currentItem.runsFinished));
        $("#photo-details-bar .ui-btn-text").html(photoHeader);
        $("#debug-details-bar .ui-btn-text").html(debugHeader);

        if (currentItem == null || (currentItem.runs > 1 && currentDataItems == null)) {
            $("#details-blob-key").text("none");
            $("#details-blob-url").text("none");
            displayNoImageAvailable();
            return;
        }

        var imageBlobKey = null;
        var imageBlobURL = null;
        if (currentItem.runs == 1) {
            imageBlobKey = currentItem.imageBlobKey;
            imageBlobURL = currentItem.imageBlobURL;
        }
        else if (currentRunid >= 1 && currentRunid <= currentItem.runs) {
            var index = parseInt(currentRunid) - 1;
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
        updateRunId();
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
        $("#details-image").attr('src', "images2/not-available-128.png");
        $("#details-image").attr('alt', "No photo is available");
    }

    //
    // public API
    //
    return {
        onDetailsPageInit:onDetailsPageInit
    }
})();
