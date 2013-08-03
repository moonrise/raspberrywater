#!/usr/bin/env python
import webapp2

MAIN_HTML = """\
<html>
    <body>
        <p>Water Main</p>
        <p><a href="/user">User</a></p>
        <p><a href="/form">Form</a></p>
    </body>
</html>
"""

class MainHandler(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write(MAIN_HTML)

app = webapp2.WSGIApplication([
    ('/', MainHandler),
], debug=True)
