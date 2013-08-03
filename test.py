#!/usr/bin/env python
import webapp2
import cgi

FORM_HTML = """\
<html>
    <body>
        <form action="/test/sign" method="post">
            <div><textarea name="content" rows="3" cols="60"></textarea></div>
            <div><input type="submit" value="Submit Test Form Content"></div>
        </form>
    </body>
</html>
"""

class FormHandler(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write(FORM_HTML)

class GuestBook(webapp2.RequestHandler):
    def post(self):
        self.response.write('<html><body>You wrote:<pre>')
        self.response.write(cgi.escape(self.request.get('content')))
        self.response.write('</pre></body></html>')

app = webapp2.WSGIApplication([
    ('/test', FormHandler),
    ('/test/sign', GuestBook)
], debug=True)
