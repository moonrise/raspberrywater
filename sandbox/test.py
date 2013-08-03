#!/usr/bin/env python
from google.appengine.api import users
import webapp2
import cgi

HELLO_HTML = """\
<html>
    <body>
        <p>Hello</p>
    </body>
</html>
"""

FORM_HTML = """
<html>
    <body>
        <form action="/test/form/sign" method="post">
            <div><textarea name="content" rows="3" cols="60"></textarea></div>
            <div><input type="submit" value="Submit Test Form Content"></div>
        </form>
    </body>
</html>
"""

class HelloHandler(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write(HELLO_HTML)

class UserHandler(webapp2.RequestHandler):
    def get(self):
        user = users.get_current_user()
        self.response.headers['Content-Type'] = 'text/plain'
        if user:
            self.response.write('Hello, ' + user.nickname())
        else:
            self.response.write('Hello water!')
            self.redirect(users.create_login_url(self.request.uri))

class FormHandler(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write(FORM_HTML)

class GuestBook(webapp2.RequestHandler):
    def post(self):
        self.response.write('<html><body>You wrote:<pre>')
        self.response.write(cgi.escape(self.request.get('content')))
        self.response.write('</pre></body></html>')

hello = webapp2.WSGIApplication([
   ('/test/hello', HelloHandler),
], debug=True)

user = webapp2.WSGIApplication([
   ('/test/user', UserHandler),
], debug=True)

form = webapp2.WSGIApplication([
    ('/test/form', FormHandler),
    ('/test/form/sign', GuestBook)
], debug=True)
