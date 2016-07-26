
from django.shortcuts import render

def index(request):
    ctx = {}
    return render(request, 'webapp/index.html', ctx)
