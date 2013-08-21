#!/usr/bin/env python
import cgi
import urllib
from google.appengine.ext import ndb
import webapp2

MAIN_PAGE_FOOTER_TEMPLATE = """\
    <form action="/app/request?%s" method="post">
      <div><textarea name="content" rows="3" cols="60"></textarea></div>
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


class Delivery(ndb.Model):
    author = ndb.StringProperty(indexed=False)
    content = ndb.StringProperty(indexed=False)
    date = ndb.DateTimeProperty(auto_now_add=True)


class MainPage(webapp2.RequestHandler):
    def get(self):
        self.response.write('<html><body>')
        hydroidUnitId = self.request.get('hydroid_unit_id', HYDROID_UNIT_ID)

        deliveryHistoryQuery = Delivery.query(ancestor=GetHydroidUnitKey(hydroidUnitId)).order(-Delivery.date)
        deliveryHistoryList = deliveryHistoryQuery.fetch(10)

        for delivery in deliveryHistoryList:
            if delivery.author:
                self.response.write('<b>%s</b> wrote:' % cgi.escape(delivery.author))
            else:
                self.response.write('An anonymous person wrote:')
            self.response.write('<blockquote>%s</blockquote>' % cgi.escape(delivery.content))

        # Write the submission form and the footer of the page
        sign_query_params = urllib.urlencode({'hydroid_unit_id': hydroidUnitId})
        self.response.write(MAIN_PAGE_FOOTER_TEMPLATE % (sign_query_params, cgi.escape(hydroidUnitId)))


class DeliveryRequest(webapp2.RequestHandler):
    def post(self):
        hydroidUnitId = self.request.get('hydroid_unit_id', HYDROID_UNIT_ID)
        delivery = Delivery(parent=GetHydroidUnitKey(hydroidUnitId))
        delivery.author = "Me"
        delivery.content = self.request.get('content')
        delivery.put()

        query_params = {'hydroid_unit_id': hydroidUnitId}
        self.redirect('/app/main?' + urllib.urlencode(query_params))


main = webapp2.WSGIApplication([
    ('/app/main', MainPage),
    ('/app/request', DeliveryRequest),
], debug=True)
