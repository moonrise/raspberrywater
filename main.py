#!/usr/bin/env python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
from google.appengine.api import users
import webapp2
import cgi

FORM_HTML = """\
<html>
    <body>
        <form action="/sign" method="post">
            <div><textarea name="content" rows="3" cols="60"></textarea></div>
            <div><input type="submit" value="Submit Content"></div>
        </form>
    </body>
</html>
"""

class MainHandler(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'text/html'
        self.response.write(FORM_HTML)

        # user = users.get_current_user()
        # self.response.headers['Content-Type'] = 'text/plain'
        # if user:
        #     self.response.write('Hello, ' + user.nickname())
        # else:
        #     self.response.write('Hello water!')
        #     self.redirect(users.create_login_url(self.request.uri))


class GuestBook(webapp2.RequestHandler):
    def post(self):
        self.response.write('<html><body>You wrote:<pre>')
        self.response.write(cgi.escape(self.request.get('content')))
        self.response.write('</pre></body></html>')

app = webapp2.WSGIApplication([
    ('/', MainHandler),
    ('/sign', GuestBook)
], debug=True)
