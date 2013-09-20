#!/usr/bin/env python
import webapp2

MAIN_HTML = """\
<html>
    <body>
        <br>
        <p><a href="/s/index.html"><b>Water Them</b></a></p>
        <br>
        <p>Test Menu (v1)</p>
        <p><a href="/test/hello">Hello</a></p>
        <p><a href="/test/user">User</a></p>
        <p><a href="/test/form">Form</a></p>
        <p><a href="/test/hrd">HRD (High Replication Datastore)</a></p>
        <p><a href="/test/hrd2">HRD2 (High Replication Datastore with Jinja2 Templating)</a></p>
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
