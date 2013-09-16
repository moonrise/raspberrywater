/**
 * squirt details module
 */

var squirtDetails = (function () {
    var historyItems;
    var currentIndex;
    var currentTicket;


    function onDetailsPageInit(event) {
        currentTicket = $(this).data("url").replace(/.*ticket=/, "");
        squirtCommon.fetchHistoryList(20, onFetchHistoryListOK);
    }

    function onFetchHistoryListOK(jsonResponse) {
        // stash history items for later navigation
        historyItems = jsonResponse.histories;

        // locate the current index of the initial ticket
        $.each(historyItems, function(index, value) {
            if (value.ticket == currentTicket) {
                currentIndex = index;
                return false;
            }
        });

        // initial update
        updateDetailsSection(historyItems[currentIndex]);
    }

    function updateDetailsSection(item) {
        // update title area
        var formatter = "details <span style='color: ivory'><i>(total tickets: %d)</i></span>";
        var htmlTitle = sprintf(formatter,  historyItems.length);
        $("#details-bar .ui-btn-text").html(htmlTitle); // $(#details-bar).html() destroys the style

        // update detail area
        $("#details-ticket").text(item.ticket);
        $("#details-drop").html(squirtCommon.getWaterDropImages(item.drops, 14));
        $("#details-request-time").text(squirtCommon.formatDate(item.requestDate));
        $("#details-request-note").text(item.comment);
        $("#details-delivery-time").text(squirtCommon.formatDate(item.deliveryDate));
        $("#details-delivery-note").html(squirtCommon.iconifyDeliveryNote(item.deliveryNote, 14));
        $("#details-blob-key").text(item.imageBlobKey);
        $("#details-blob-url").text(item.imageBlobURL);

        // update image area
        try {
            if (item.imageBlobURL && !item.imageBlobURL.endsWith("None")) {
                $("#details-image").attr('src', item.imageBlobURL);
                $("#details-image").attr('alt', item.imageBlobURL);
            }
            else {
                displayNoImageAvailable();
            }
        }
        catch (e) {
            displayNoImageAvailable();
        }
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
