#!/usr/bin/env python
import time
import cgi
import urllib
import webapp2
import json
from google.appengine.api import images
from google.appengine.ext import ndb
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers


HYDROID_UNIT_ID = 'hydroid6'

JOB_STATE_PENDING = "pending"
JOB_STATE_BUMPED = "bumped"
JOB_STATE_TIMEDOUT = "timed out"
JOB_STATE_CANCELED = "canceled"


def getMilliSinceEpoch():
    return int(time.time() * 1000)


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
        ticket.measure = 0          # just to keep track of the measure key
        ticket.drops = 0
        ticket.photo = "0"
        ticket.envread = "0"
        ticket.runs = 0
        ticket.interval = 0
        ticket.intervalUnit = "d"
        ticket.start = 1
        ticket.requestNote = ''
        ticket.pendingStateCid = 0  # pending state change id ==> change it activeStateCid
        ticket.historyListCid = 0   # history list change id
        ticket.put()
        singletonTicket = GetSingletonTicketKey(hydroidUnitId).get() # get it right back
    return singletonTicket


class Ticket(ndb.Model):
    ticket = ndb.IntegerProperty()
    measure = ndb.IntegerProperty()
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
    runsFinished = ndb.IntegerProperty()  # may not reach runs because of execution lag or other issues
    finished = ndb.BooleanProperty()      # job for this ticket is finished
    deliveryDate = ndb.IntegerProperty()
    deliveryNote = ndb.StringProperty()
    temperature = ndb.IntegerProperty()
    moisture = ndb.IntegerProperty()
    imageBlobKey = ndb.BlobKeyProperty()
    imageBlobURL = ndb.StringProperty()


class Measure(ndb.Model):
    ticket = ndb.IntegerProperty(indexed=True)
    runid = ndb.IntegerProperty(indexed=True)
    time = ndb.IntegerProperty()
    drops = ndb.IntegerProperty()
    temperature = ndb.IntegerProperty()
    moisture = ndb.IntegerProperty()
    imageBlobKey = ndb.BlobKeyProperty()
    imageBlobURL = ndb.StringProperty()


def GetMeasureKey(key, hydroidUnitId=HYDROID_UNIT_ID):
    return ndb.Key(Measure, key, parent=GetHydroidUnitKey(hydroidUnitId))


def CreateMeasure(hydroidUnitId=HYDROID_UNIT_ID):
    ticket = GetSingletonTicket()
    ticket.measure += 1
    ticket.put()
    measureId = ticket.measure

    measureKey = GetMeasureKey(measureId, hydroidUnitId)
    return Measure(key=measureKey)


def GetDeliveryItemForTicket(ticket, hydroidUnitId):
    # target delivery - create one if not there
    deliveryKey = GetDeliveryKey(ticket, hydroidUnitId)
    delivery = deliveryKey.get()
    if not delivery:
        delivery = Delivery(key=deliveryKey)
    return delivery


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
        elif command == "fetchActiveTaskList":
            self.response.write(json.dumps(FetchActiveTaskList()))
        elif command == "fetchHistoryList":
            self.response.write(json.dumps(FetchHistoryList(jsonRequest)))
        elif command == "fetchActiveAndHistoricalList":
            self.response.write(json.dumps(FetchActiveAndHistoricalList(jsonRequest)))
        elif command == "submitSquirtRequest":
            self.response.write(json.dumps(SubmitSquirtRequest(jsonRequest)))
        elif command == "confirmDelivery":
            self.response.write(json.dumps(ConfirmDelivery(jsonRequest)))
        elif command == "fetchMeasures":
            self.response.write(json.dumps(FetchMeasures(jsonRequest)))
        elif command == "procureUploadURL":
            self.response.write(json.dumps(ProcureUploadURL()))
        elif command == "cancelJob":
            self.response.write(json.dumps(RequestJobCancel(jsonRequest)))
        else:
            self.response.write(json.dumps({'apiError': "%s is invalid command" % command}))


class OnUpload(blobstore_handlers.BlobstoreUploadHandler):
    def post(self):
        ticketNo = int(self.request.headers['ticket'])
        runs = int(self.request.headers['runs'])
        blobInfo = self.get_uploads()[0]

        # store the blob key
        if runs == 1:       # single instance data is stored in the delivery data itself
            delivered = GetDeliveryItemForTicket(ticketNo, HYDROID_UNIT_ID)
            if delivered:
                delivered.imageBlobKey = blobInfo.key()
                delivered.imageBlobURL = images.get_serving_url(delivered.imageBlobKey)
                delivered.put()
                DirtyHistoryList()
            else:
                blobInfo.delete()
        else:               # multi data instance
            runid = int(self.request.headers['runid'])
            measureQuery = Measure.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID))\
                .filter(Measure.ticket == ticketNo).filter(Measure.runid == runid)

            # todo: a better way of getting the single result?
            # todo: like this: measure = measureQuery.fetch(1)[0]? but did not work?!!
            measure = None
            for m in measureQuery:
                measure = m

            if measure:
                measure.imageBlobKey = blobInfo.key()
                measure.imageBlobURL = images.get_serving_url(measure.imageBlobKey)
                measure.put()
            else:
                blobInfo.delete()


class OnView(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self, blobKey):
        resource = str(urllib.unquote(blobKey))
        if not blobstore.get(resource):
            self.error(404)
        else:
            self.send_blob(resource)


def DirtyActiveState():
    ticket = GetSingletonTicket()
    ticket.pendingStateCid += 1
    ticket.put()


def DirtyHistoryList():
    ticket = GetSingletonTicket()
    ticket.historyListCid += 1
    ticket.put()


def DirtyAllStates():
    ticket = GetSingletonTicket()
    ticket.pendingStateCid += 1
    ticket.historyListCid += 1
    ticket.put()


def QueryChangeState():
    ticket = GetSingletonTicket()
    return {'activeStateCid': ticket.pendingStateCid,
            'historyListCid': ticket.historyListCid,
    }


def SubmitSquirtRequest(jsonRequest):
    runs = jsonRequest['runs']
    start = jsonRequest['start']

    # you can have only one of single immediate run at any time
    if runs == 1 and start <= 0:
        query = Delivery.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID)) \
            .filter(Delivery.finished == False) \
            .filter(Delivery.runs == 1)\
            .filter(Delivery.start < 1)

        bumped = False
        for d in query.fetch():
            d.finished = True
            d.deliveryNote = JOB_STATE_BUMPED
            d.put()
            bumped = True

        if bumped:
            DirtyAllStates()

    # now submit the request by adding to the active list
    AddToHistory(HYDROID_UNIT_ID, jsonRequest)
    return {}


def RequestJobCancel(jsonRequest):
    ticketToCancel = jsonRequest['ticket']
    query = Delivery.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID)) \
        .filter(Delivery.finished == False) \
        .filter(Delivery.ticket == ticketToCancel)

    cancelTarget = None
    for delivery in query:
        cancelTarget = delivery

    if delivery:
        delivery.finished = True
        delivery.deliveryNote = JOB_STATE_CANCELED
        delivery.put()
        DirtyAllStates()


def ConfirmDelivery(jsonRequest):
    deliveredTicket = int(jsonRequest['ticket'])
    runid = int(jsonRequest['runid'])
    runs = int(jsonRequest['runs'])

    # update the one in history
    delivered = GetDeliveryItemForTicket(deliveredTicket, HYDROID_UNIT_ID)
    if delivered:
        delivered.runsFinished = runid
        delivered.finished = jsonRequest['finished'] in '1'
        delivered.deliveryDate = int(jsonRequest['deliveryDate'])
        delivered.deliveryNote = jsonRequest['deliveryNote']
        if runs == 1 and runid == 1: # single instance data is stored in the delivery data itself
            delivered.temperature = int(jsonRequest['temperature'])
            delivered.moisture = int(jsonRequest['moisture'])
        delivered.put()
        DirtyAllStates()

    # multi run data is stored in the measure db
    if runs > 1 and runid > 0:
        measure = CreateMeasure()
        measure.ticket = deliveredTicket
        measure.runid = runid
        measure.time = int(jsonRequest['deliveryDate'])
        measure.temperature = int(jsonRequest['temperature'])
        measure.moisture = int(jsonRequest['moisture'])
        measure.put()

    return {}


def GetDeliveryItemInHistory(ticket, hydroidUnitId):
    # target delivery - create one if not there
    deliveryKey = GetDeliveryKey(ticket, hydroidUnitId)
    delivery = deliveryKey.get()
    return delivery


def GetDeliveryItemForTicket(ticket, hydroidUnitId):
    # target delivery - create one if not there
    deliveryKey = GetDeliveryKey(ticket, hydroidUnitId)
    delivery = deliveryKey.get()
    if not delivery:
        delivery = Delivery(key=deliveryKey)
    return delivery


def AddToHistory(hydroidUnitId, jsonRequest):
    # source ticket
    ticket = GetSingletonTicket()
    ticket.ticket += 1

    # target delivery - create one if not there
    delivery = GetDeliveryItemForTicket(ticket.ticket, hydroidUnitId)

    # copy from source to target
    delivery.ticket = ticket.ticket
    delivery.drops = int(jsonRequest['drops'])
    delivery.photo = jsonRequest['photo']
    delivery.envread = jsonRequest['envread']
    delivery.runs = int(jsonRequest['runs'])
    delivery.interval = int(jsonRequest['interval'])
    delivery.intervalUnit = jsonRequest['intervalUnit']
    delivery.start = int(jsonRequest['start'])
    delivery.requestNote = jsonRequest['requestNote']
    delivery.requestDate = int(jsonRequest['requestDate'])
    delivery.runsFinished = 0
    delivery.finished = False
    delivery.deliveryDate = -1
    delivery.deliveryNote = JOB_STATE_PENDING
    delivery.temperature = -1
    delivery.moisture = -1
    delivery.imageBlobKey = None
    delivery.imageBlobURL = None
    delivery.put()

    ticket.pendingStateCid += 1
    ticket.put()


def computeEndTime(delivery, startTime):
    interval = delivery.interval
    if delivery.intervalUnit == 'm':
        interval *= 60
    elif delivery.intervalUnit == 'h':
        interval *= 60*60
    elif delivery.intervalUnit == 'd':
        interval *= 60*60*24
    return startTime + interval * delivery.runs * 1000


def InvalidateTimedOutJobs():
    # deactivate timed out jobs
    query = Delivery.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID)) \
        .filter(Delivery.finished == False)

    now = getMilliSinceEpoch()
    for d in query.fetch():
        if d.start > 0:
            if d.runs == 1 and d.start >= (now + 2000):  # give a few seconds of margin
                continue
            if d.runs > 1 and computeEndTime(d, d.start) > (now - 2000):  # give a few seconds of margin
                continue
        else:
            if d.runs == 1:     # once, immediate never times out
                continue
            if d.runs > 1 and (d.runsFinished <= 0 or computeEndTime(d, now) > (now - 2000)):
                continue

        # timed out job
        d.finished = True
        d.deliveryNote = JOB_STATE_TIMEDOUT
        d.put()
        DirtyAllStates()


def FetchActiveTaskList():
    InvalidateTimedOutJobs()

    # all invalids are filtered out now
    query = Delivery.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID))\
        .filter(Delivery.finished == False).order(-Delivery.ticket)
    return toJsonDeliveryList(query.fetch())


def FetchHistoryList(jsonRequest):
    query = Delivery.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID)) \
        .filter(Delivery.finished == True).order(-Delivery.ticket)

    topN = jsonRequest['topN']
    if topN <= 0:
        return toJsonDeliveryList(query.fetch())    # return all rows
    else:
        return toJsonDeliveryList(query.fetch(topN))


def FetchActiveAndHistoricalList(jsonRequest):
    query = Delivery.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID)) \
        .order(-Delivery.ticket)

    topN = jsonRequest['topN']
    if topN <= 0:
        return toJsonDeliveryList(query.fetch())    # return all rows
    else:
        return toJsonDeliveryList(query.fetch(topN))


def toJsonDeliveryList(queryResults):
    list = []
    for delivery in queryResults:
        list.append({
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
            'runsFinished': delivery.runsFinished if delivery.runsFinished is not None else 0,
            'finished': delivery.finished,
            'deliveryDate': delivery.deliveryDate,
            'deliveryNote': delivery.deliveryNote,
            'temperature': delivery.temperature,
            'moisture': delivery.moisture,
            'imageBlobKey': str(delivery.imageBlobKey),
            'imageBlobURL': str(delivery.imageBlobURL),
        })

    return {'length': list.__len__(),
            'list': list
    }


def FetchMeasures(jsonRequest):
    ticket = int(jsonRequest['ticket'])
    measureQuery = Measure.query(ancestor=GetHydroidUnitKey(HYDROID_UNIT_ID)).filter(Measure.ticket == ticket)

    measureList = []
    for m in measureQuery:
        measureList.append({
            'runid': m.runid,
            'time': m.time,
            'drops': m.drops,
            'temperature': m.temperature,
            'moisture': m.moisture,
            'imageBlobKey': str(m.imageBlobKey),
            'imageBlobURL': str(m.imageBlobURL)
        })

    return {'length': measureList.__len__(),
            'measures': measureList }


def ProcureUploadURL():
    uploadUrl = blobstore.create_upload_url('/app/upload')
    return {'url': cgi.escape(uploadUrl)}


main = webapp2.WSGIApplication([
            ('/app/jsonApi', JsonAPI),
            ('/app/upload', OnUpload),
            ('/app/view/([^/]+)?', OnView),
            ], debug=True)
