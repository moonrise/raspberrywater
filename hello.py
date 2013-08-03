#!/usr/bin/env python
from google.appengine.api import users
import webapp2

class HelloHandler(webapp2.RequestHandler):
    def get(self):
        user = users.get_current_user()
        self.response.headers['Content-Type'] = 'text/plain'
        if user:
            self.response.write('Hello 2, ' + user.nickname())
        else:
            self.response.write('Hello water!')
            self.redirect(users.create_login_url(self.request.uri))

app = webapp2.WSGIApplication([
    ('/hello', HelloHandler),
], debug=True)
