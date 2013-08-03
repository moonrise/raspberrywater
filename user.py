#!/usr/bin/env python
from google.appengine.api import users
import webapp2

class UserHandler(webapp2.RequestHandler):
    def get(self):
        user = users.get_current_user()
        self.response.headers['Content-Type'] = 'text/plain'
        if user:
            self.response.write('Hello, ' + user.nickname())
        else:
            self.response.write('Hello water!')
            self.redirect(users.create_login_url(self.request.uri))

app = webapp2.WSGIApplication([
    ('/user', UserHandler),
], debug=True)
