"""Middleware to force `charset=utf-8` on JSON responses.

Some browsers default to Latin-1 when application/json is sent without
charset, producing mojibake (e.g. PrÃ©sÃ©lectionnÃ© instead of Présélectionné).
"""


class UTF8JSONCharsetMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        ct = response.get('Content-Type', '')
        if ct.startswith('application/json') and 'charset' not in ct:
            response['Content-Type'] = 'application/json; charset=utf-8'
        return response
