#!/usr/bin/env python
import cgi
import urllib
from google.appengine.ext import ndb
import webapp2
import json

MAIN_PAGE_FOOTER_TEMPLATE = """\
    <form action="/app/request?%s" method="post">
      <div><textarea name="comment" rows="3" cols="60"></textarea></div>
      <div><input type="submit" value="Request Water Squirt"></div>
    </form>
    <hr>
    <form>Hydroid Unit ID:
      <input value="%s" name="hydroid_unit_id">
      <input type="submit" value="Use This Unit">
    </form>
  </body>
</html>
"""

HYDROID_UNIT_ID = 'hydroid8'

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
        ticket.ticket = 1
        ticket.drops = 0
        ticket.comment = 'no request'
        ticket.put()
        singletonTicket = GetSingletonTicketKey(hydroidUnitId).get() # get it right back
    return singletonTicket

class Ticket(ndb.Model):
    ticket = ndb.IntegerProperty(indexed=False)
    drops = ndb.IntegerProperty(indexed=False)
    comment = ndb.StringProperty(indexed=False)
    date = ndb.IntegerProperty(indexed=False)

class Delivery(ndb.Model):
    ticket = ndb.IntegerProperty(indexed=True)
    drops = ndb.IntegerProperty(indexed=False)
    comment = ndb.StringProperty(indexed=False)
    date = ndb.IntegerProperty(indexed=False)


class MainPage(webapp2.RequestHandler):
    def get(self):
        self.response.write('<html><body>')

        # get the current hydroid unit id
        hydroidUnitId = self.request.get('hydroid_unit_id', HYDROID_UNIT_ID)

        # get the singleton ticket
        singletonTicket = GetSingletonTicketKey(hydroidUnitId).get()
        if not singletonTicket:
            ticket = Ticket(key=GetSingletonTicketKey(hydroidUnitId))
            ticket.ticket = 1
            ticket.drops = 0
            ticket.comment = 'no request'
            ticket.put()
            singletonTicket = GetSingletonTicketKey(hydroidUnitId).get() # get it right back

        # title
        self.response.write('<br>Hydroid Unit: <b>%s</b><br>' % hydroidUnitId)

        # current request stat
        self.response.write('<br><hr>Current Request Queue<br>')
        self.response.write('Ticket number: %d<br>' % singletonTicket.ticket)
        self.response.write('Drop count: %d<br>' % singletonTicket.drops)
        self.response.write('Comment: %s<br>' % singletonTicket.comment)

        # history
        self.response.write('<br><hr>History<br>')
        deliveryHistoryQuery = Delivery.query(ancestor=GetHydroidUnitKey(hydroidUnitId)).order(-Delivery.date)
        deliveryHistoryList = deliveryHistoryQuery.fetch(10)

        for delivery in deliveryHistoryList:
            if delivery.comment:
                self.response.write('comment: %s' % cgi.escape(delivery.comment))

        # request form
        self.response.write('<br><hr>Make Request<br>')
        sign_query_params = urllib.urlencode({'hydroid_unit_id': hydroidUnitId})
        self.response.write(MAIN_PAGE_FOOTER_TEMPLATE % (sign_query_params, cgi.escape(hydroidUnitId)))


class JsonAPI(webapp2.RequestHandler):
    def post(self):
        # parse request
        jsonRequest = json.loads(cgi.escape(self.request.body))

        # response
        self.response.headers['Content-Type'] = 'application/json'
        command = jsonRequest['command']
        if command == "fetchPendingRequest":
            self.response.write(json.dumps(FetchPendingRequestStatus()))
        elif command == "submitSquirtRequest":
            self.response.write(json.dumps(SubmitSquirtRequest(jsonRequest)))
        elif command == "confirmSquirtDelivery":
            self.response.write(json.dumps(ConfirmSquirtDelivery(jsonRequest)))
        else:
            self.response.write(json.dumps({'apierror':"%s is invalid command" % command}))

def FetchPendingRequestStatus():
    ticket = GetSingletonTicket()
    return {'ticket': ticket.ticket,
            'drops': ticket.drops,
            'date': ticket.date,
            'comment': ticket.comment
           }

def SubmitSquirtRequest(jsonRequest):
    ticket = GetSingletonTicket()
    if ticket.drops <= 0:   # only if the pending request was delivered (which means zero drops
        ticket.ticket += 1
    ticket.drops = int(jsonRequest['drops'])
    ticket.comment = jsonRequest['comment']
    ticket.date = int(jsonRequest['date'])
    ticket.put()
    return {}

def ConfirmSquirtDelivery(jsonRequest):
    ticket = GetSingletonTicket()
    ticket.drops = 0
    ticket.comment = ""
    ticket.date = 0
    ticket.put()
    return {}


class DeliveryRequest(webapp2.RequestHandler):
    def post(self):
        # request water drop
        hydroidUnitId = self.request.get('hydroid_unit_id', HYDROID_UNIT_ID)
        singletonTicket = GetSingletonTicketKey(hydroidUnitId).get()
        if singletonTicket.drops == 0:
            singletonTicket.ticket += 1
        singletonTicket.drops = 1
        singletonTicket.comment = self.request.get('comment')
        singletonTicket.put()

        # back to main page
        query_params = {'hydroid_unit_id': hydroidUnitId}
        self.redirect('/app/main?' + urllib.urlencode(query_params))


main = webapp2.WSGIApplication([
    ('/app/main', MainPage),
    ('/app/request', DeliveryRequest),
    ('/app/jsonApi', JsonAPI),
], debug=True)
