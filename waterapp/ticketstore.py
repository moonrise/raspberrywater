#!/usr/bin/env python
import cgi
import urllib
import webapp2
import json
from google.appengine.api import images
from google.appengine.ext import ndb
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers


HYDROID_UNIT_ID = 'hydroid9'


def GetHydroidUnitKey(hydroidUnitId=HYDROID_UNIT_ID):
    """Constructs a Datastore key for a hydroid unit instance id."""
    return ndb.Key('HydroidUnit', hydroidUnitId)


def GetSingletonTicketKey(hydroidUnitId=HYDROID_UNIT_ID):
    return ndb.Key(Ticket, '1', parent=GetHydroidUnitKey(hydroidUnitId))


def GetSingletonTicket(hydroidUnitId=HYDROID_UNIT_ID):
    # get the singleton ticket - returns a valid non-empty ticket always
    singletonTicket = GetSingletonTicketKey(hydroidUnitId).get()
    if not singletonTicket:
        ticket = Ticket(key=GetSingletonTicketKey(hydroidUnitId))
        ticket.ticket = 1           # valid ticket starts from zero
        ticket.drops = 0
        ticket.photo = "0"
        ticket.envread = "0"
        ticket.runs = 0
        ticket.interval = 0
        ticket.intervalUnit = "d"
        ticket.start = 1
        ticket.requestNote = ''
        ticket.pendingStateCid = 0  # pending state change id
        ticket.historyListCid = 0   # history list change id
        ticket.put()
        singletonTicket = GetSingletonTicketKey(hydroidUnitId).get() # get it right back
    return singletonTicket


class Ticket(ndb.Model):
    ticket = ndb.IntegerProperty()
    drops = ndb.IntegerProperty()
    photo = ndb.StringProperty()
    envread = ndb.StringProperty()
    runs = ndb.IntegerProperty()
    interval = ndb.IntegerProperty()
    intervalUnit = ndb.StringProperty()
    start = ndb.IntegerProperty()
    requestNote = ndb.StringProperty()
    requestDate = ndb.IntegerProperty()
    pendingStateCid = ndb.IntegerProperty()
    historyListCid = ndb.IntegerProperty()
    imageBlobKey = ndb.BlobKeyProperty()


def GetDeliveryKey(key, hydroidUnitId=HYDROID_UNIT_ID):
    return ndb.Key(Delivery, key, parent=GetHydroidUnitKey(hydroidUnitId))


class Delivery(ndb.Model):
    ticket = ndb.IntegerProperty(indexed=True)
    drops = ndb.IntegerProperty()
    photo = ndb.StringProperty()
    envread = ndb.StringProperty()
    runs = ndb.IntegerProperty()
    interval = ndb.IntegerProperty()
    intervalUnit = ndb.StringProperty()
    start = ndb.IntegerProperty()
    requestNote = ndb.StringProperty()
    requestDate = ndb.IntegerProperty()
    deliveryDate = ndb.IntegerProperty()
    deliveryNote = ndb.StringProperty()
    imageBlobKey = ndb.BlobKeyProperty()


def DirtyHistoryList():
    ticket = GetSingletonTicket()
    ticket.historyListCid += 1
    ticket.put()


class JsonAPI(webapp2.RequestHandler):
    def post(self):
        # parse request
        jsonRequest = json.loads(cgi.escape(self.request.body))

        # response
        self.response.headers['Content-Type'] = 'application/json'
        command = jsonRequest['command']
        if command == "queryChangeState":
            self.response.write(json.dumps(QueryChangeState()))
        elif command == "fetchPendingRequest":
            self.response.write(json.dumps(FetchPendingRequestStatus()))
        elif command == "submitSquirtRequest":
            self.response.write(json.dumps(SubmitSquirtRequest(jsonRequest)))
        elif command == "confirmSquirtDelivery":
            self.response.write(json.dumps(ConfirmSquirtDelivery(jsonRequest)))
        elif command == "fetchHistoryList":
            self.response.write(json.dumps(FetchHistoryList()))
        elif command == "procureUploadURL":
            self.response.write(json.dumps(ProcureUploadURL()))
        else:
            self.response.write(json.dumps({'apiError': "%s is invalid command" % command}))


class OnUpload(blobstore_handlers.BlobstoreUploadHandler):
    def post(self):
        ticketNo = int(self.request.headers['Ticket'])
        blobInfo = self.get_uploads()[0]

        # store the blob key
        delivered = GetDeliveryItemForTicket(ticketNo, HYDROID_UNIT_ID)
        if delivered:
            delivered.imageBlobKey = blobInfo.key()
            delivered.put()
            DirtyHistoryList()
        else:
            blobInfo.delete()


class OnView(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self, blobKey):
        resource = str(urllib.unquote(blobKey))
        if not blobstore.get(resource):
            self.error(404)
        else:
            self.send_blob(resource)


def QueryChangeState():
    ticket = GetSingletonTicket()
    return {'pendingStateCid': ticket.pendingStateCid,
            'historyListCid': ticket.historyListCid,
    }


def FetchPendingRequestStatus():
    ticket = GetSingletonTicket()
    return {'ticket': ticket.ticket,
            'drops': ticket.drops,
            'photo': ticket.photo,
            'envread': ticket.envread,
            'runs': ticket.runs,
            'interval': ticket.interval,
            'intervalUnit': ticket.intervalUnit,
            'start': ticket.start,
            'requestDate': ticket.requestDate,
            'requestNote': ticket.requestNote
    }


def SubmitSquirtRequest(jsonRequest):
    ticket = GetSingletonTicket()

    # replace the pending request and move the old one to history
    MoveToHistory(HYDROID_UNIT_ID)

    # new request
    ticket.drops = int(jsonRequest['drops'])
    ticket.photo = jsonRequest['photo']
    ticket.envread = jsonRequest['envread']
    ticket.runs = int(jsonRequest['runs'])
    ticket.interval = int(jsonRequest['interval'])
    ticket.intervalUnit = jsonRequest['intervalUnit']
    ticket.start = int(jsonRequest['start'])
    ticket.requestNote = jsonRequest['requestNote']
    ticket.requestDate = int(jsonRequest['requestDate'])
    ticket.pendingStateCid += 1
    ticket.put()
    return {}


def ConfirmSquirtDelivery(jsonRequest):
    # clear pending request - no matter what
    MoveToHistory(HYDROID_UNIT_ID)

    # update the one in history
    deliveredTicket = int(jsonRequest['ticket'])
    delivered = GetDeliveryItemForTicket(deliveredTicket, HYDROID_UNIT_ID)
    if delivered:
        delivered.deliveryDate = long(jsonRequest['deliveryDate'])
        delivered.deliveryNote = jsonRequest['deliveryNote']
        delivered.put()
        DirtyHistoryList();

    return {}


def GetDeliveryItemForTicket(ticket, hydroidUnitId):
    # target delivery - create one if not there
    deliveryKey = GetDeliveryKey(ticket, hydroidUnitId)
    delivery = deliveryKey.get()
    if not delivery:
        delivery = Delivery(key=deliveryKey)
    return delivery


def MoveToHistory(hydroidUnitId):    # moves the pending data to history list
    # source ticket
    ticket = GetSingletonTicket()

    # target delivery - create one if not there
    delivery = GetDeliveryItemForTicket(ticket.ticket, hydroidUnitId)

    # copy from source to target
    delivery.ticket = ticket.ticket
    delivery.drops = ticket.drops
    delivery.photo = ticket.photo
    delivery.envread = ticket.envread
    delivery.runs = ticket.runs
    delivery.interval = ticket.interval
    delivery.intervalUnit = ticket.intervalUnit
    delivery.start = ticket.start
    delivery.requestDate = ticket.requestDate
    delivery.requestNote = ticket.requestNote
    delivery.put()

    # clear up source (the pending data) with the ticket incremented
    ticket.ticket += 1
    ticket.drops = 0
    ticket.photo = '0'
    ticket.envread = '0'
    ticket.runs = 0
    ticket.interval = 0
    ticket.intervalUnit = 'd'
    ticket.start = -1
    ticket.requestNote = ''
    ticket.requestDate = 0
    ticket.pendingStateCid += 1
    ticket.historyListCid += 1
    ticket.put()

    return delivery


def FetchHistoryList():
    deliveryHistoryQuery = Delivery.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID)).order(-Delivery.ticket)
    deliveryHistoryList = deliveryHistoryQuery.fetch(10)

    historyList = []
    for delivery in deliveryHistoryList:
        historyList.append({
            'ticket': delivery.ticket,
            'drops': delivery.drops,
            'photo': delivery.photo,
            'envread': delivery.envread,
            'runs': delivery.runs,
            'interval': delivery.interval,
            'intervalUnit': delivery.intervalUnit,
            'start': delivery.start,
            'requestNote': delivery.requestNote,
            'requestDate': delivery.requestDate,
            'deliveryDate': delivery.deliveryDate,
            'deliveryNote': delivery.deliveryNote,
            'imageBlobKey': str(delivery.imageBlobKey),
            'imageBlobURL': images.get_serving_url(delivery.imageBlobKey) if delivery.imageBlobKey else str(None)
        })

    return {'length': historyList.__len__(),
            'histories': historyList
    }


def ProcureUploadURL():
    uploadUrl = blobstore.create_upload_url('/app/upload')
    return {'url': cgi.escape(uploadUrl)}


main = webapp2.WSGIApplication([
                                   ('/app/jsonApi', JsonAPI),
                                   ('/app/upload', OnUpload),
                                   ('/app/view/([^/]+)?', OnView),
                               ], debug=True)
