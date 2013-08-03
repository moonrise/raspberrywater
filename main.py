#!/usr/bin/env python
import webapp2

MAIN_HTML = """\
<html>
    <body>
        <p>Test Menu</p>
        <p><a href="/test/hello">Hello</a></p>
        <p><a href="/test/user">User</a></p>
        <p><a href="/test/form">Form</a></p>
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
