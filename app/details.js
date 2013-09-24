/**
 * squirt details module
 */

var squirtDetails = (function () {
    var historyItems;
    var currentIndex = -1;
    var currentTicket;


    function onDetailsPageInit(event) {
        // refresh handler
        $("#details-refresh-button").click(onDetailsRefresh);
        $("#details-prev-button").click(onDetailsPrev);
        $("#details-next-button").click(onDetailsNext);

        currentTicket = $(this).data("url").replace(/.*ticket=/, "");
        currentIndex = -1;
        updateButtonStates();
        onDetailsRefresh();
    }

    function onDetailsRefresh() {
        squirtCommon.fetchHistoryList(20, onFetchHistoryListOK);
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

    function onFetchHistoryListOK(jsonResponse) {
        // stash history items for later navigation
        historyItems = jsonResponse.histories;

        // locate the current index of the initial ticket
        if (currentIndex < 0) {
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
        var historyItem = historyItems[currentIndex];
        updateDetailsSection(historyItem);
        updateDataTableSection(historyItem);
    }

    function updateDetailsSection(item) {
        // update title area
        var formatter = "details <span style='color: ivory'><i>(total tickets: %d)</i></span>";
        var htmlTitle = sprintf(formatter,  historyItems.length);
        $("#details-bar .ui-btn-text").html(htmlTitle); // $(#details-bar).html() destroys the style

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

        // debug-only
        $("#details-blob-key").text(item.imageBlobKey);
        $("#details-blob-url").text(item.imageBlobURL);

        // update image area
        if (item.imageBlobURL && !String(item.imageBlobURL).match(/None$/)) {
            $("#details-image").attr('src', item.imageBlobURL);
            $("#details-image").attr('alt', item.imageBlobURL);
        }
        else {
            displayNoImageAvailable();
        }
    }

    function updateDataTableSection(historyItem) {
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
        $("#table-body").html(buildTableRows(dataItems));
        $("#data-table").table('refresh');
    }

    function buildTableRows(dataItems) {
        var htmlItems = [];

        $.each(dataItems, function(index, item) {
            var e = ['<tr>'];
            e.push(sprintf('<th>%d</th>', item.runid));
            e.push(sprintf('<td>%d</td>', item.temperature));
            e.push(sprintf('<td>%d</td>', item.moisture));
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
